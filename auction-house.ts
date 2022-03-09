// import { program } from 'commander';
// import log from 'loglevel';
import {
    deserializeAccount,
    getAtaForMint,
    getAuctionHouse,
    getAuctionHouseBuyerEscrow,
    getAuctionHouseFeeAcct,
    getAuctionHouseProgramAsSigner,
    getAuctionHouseTradeState,
    getAuctionHouseTreasuryAcct,
    getMetadata,
    getTokenAmount,
    loadAuctionHouseProgram,
    loadWalletKey,
} from './helpers/accounts';
import { BN, web3 } from '@project-serum/anchor';
import {
    TOKEN_PROGRAM_ID,
    WRAPPED_SOL_MINT,
} from './helpers/constants';
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';
import { getPriceWithMantissa } from './helpers/various';
import { sendTransactionWithRetryWithKeypair } from './helpers/transactions';
import { decodeMetadata, Metadata } from './helpers/schema';

export async function getAuctionHouseFromOpts(
    auctionHouse: any,
    walletKeyPair: any,
    tMintKey: any,
) {
    let auctionHouseKey;
    if (auctionHouse) {
        auctionHouseKey = new web3.PublicKey(auctionHouse);
    } else {
        // console.log(
        console.log(
            'No auction house explicitly passed in, assuming you are creator on it and deriving key...',
        );
        auctionHouseKey = (
            await getAuctionHouse(walletKeyPair.publicKey, tMintKey)
        )[0];
    }
    return auctionHouseKey;
}

// programCommand('show_escrow')
//   .option('-ah, --auction-house <string>', 'Specific auction house')
//   .option(
//     '-w, --wallet <string>',
//     'Specific wallet owner of escrow. If not present, we use your keypair.',
//   )
//   .action(async (directory, cmd) => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const show_escrow = async (directory: any, cmd: any) => {
    const { keypair, env, auctionHouse, wallet } = cmd.opts();

    const otherWallet = wallet ? new web3.PublicKey(wallet) : null;
    const walletKeyPair = loadWalletKey(keypair);
    const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);

    const auctionHouseKey = new web3.PublicKey(auctionHouse);
    const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
        auctionHouseKey,
    );

    if (!otherWallet) {
        //   log.info('No --wallet passed in, defaulting to keypair');
        console.log('No --wallet passed in, defaulting to keypair');
    }
    const escrow = (
        await getAuctionHouseBuyerEscrow(
            auctionHouseKey,
            otherWallet || walletKeyPair.publicKey,
        )
    )[0];

    const amount = await getTokenAmount(
        anchorProgram,
        escrow,
        //@ts-ignore
        auctionHouseObj.treasuryMint,
    );

    // log.info(
    console.log(
        otherWallet?.toBase58() || walletKeyPair.publicKey.toBase58(),
        'Balance:',
        amount,
    );
};

// programCommand('withdraw')
//   .option('-ah, --auction-house <string>', 'Specific auction house')
//   .option(
//     '-ak, --auction-house-keypair <string>',
//     'If this auction house requires sign off, pass in keypair for it',
//   )
//   .option('-a, --amount <string>', 'Amount to withdraw')
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   .action(async (directory, cmd) => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const withdraw = async (directory: any, cmd: any) => {
    const { keypair, env, amount, auctionHouse, auctionHouseKeypair } =
        cmd.opts();
    const auctionHouseKey = new web3.PublicKey(auctionHouse);
    const walletKeyPair = loadWalletKey(keypair); ``

    const auctionHouseKeypairLoaded = auctionHouseKeypair
        ? loadWalletKey(auctionHouseKeypair)
        : null;
    const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);
    const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
        auctionHouseKey,
    );
    const amountAdjusted = await getPriceWithMantissa(
        amount,
        //@ts-ignore
        auctionHouseObj.treasuryMint,
        walletKeyPair,
        anchorProgram,
    );

    const [escrowPaymentAccount, bump] = await getAuctionHouseBuyerEscrow(
        auctionHouseKey,
        walletKeyPair.publicKey,
    );

    //@ts-ignore
    const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);

    const ata = (
        await getAtaForMint(
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            walletKeyPair.publicKey,
        )
    )[0];
    const signers: any[] = [];

    const currBal = await getTokenAmount(
        anchorProgram,
        escrowPaymentAccount,
        //@ts-ignore
        auctionHouseObj.treasuryMint,
    );

    const instruction = await anchorProgram.instruction.withdraw(
        bump,
        new BN(amountAdjusted),
        {
            accounts: {
                wallet: walletKeyPair.publicKey,
                receiptAccount: isNative ? walletKeyPair.publicKey : ata,
                escrowPaymentAccount,
                //@ts-ignore
                treasuryMint: auctionHouseObj.treasuryMint,
                //@ts-ignore
                authority: auctionHouseObj.authority,
                auctionHouse: auctionHouseKey,
                //@ts-ignore
                auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                rent: web3.SYSVAR_RENT_PUBKEY,
                ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            },
            signers,
        },
    );

    if (auctionHouseKeypairLoaded) {
        signers.push(auctionHouseKeypairLoaded);

        instruction.keys
            .filter((k: any) => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
            .map((k: any) => (k.isSigner = true));
    }

    instruction.keys
        .filter((k: any) => k.pubkey.equals(walletKeyPair.publicKey))
        .map((k: any) => (k.isSigner = true));

    await sendTransactionWithRetryWithKeypair(
        anchorProgram.provider.connection,
        walletKeyPair,
        [instruction],
        signers,
        'max',
    );

    // log.info(
    console.log(
        'Withdrew',
        amountAdjusted,
        'from your account with Auction House',
        auctionHouse,
        '. New Balance:',
        currBal - amountAdjusted,
    );
};

// programCommand('sell')
//   .option('-ah, --auction-house <string>', 'Specific auction house')
//   .option(
//     '-ak, --auction-house-keypair <string>',
//     'If this auction house requires sign off, pass in keypair for it',
//   )
//   .option(
//     '-aks, --auction-house-signs',
//     'If you want to simulate the auction house changing the price without your sign off',
//   )
//   .option('-b, --buy-price <string>', 'Price you wish to sell for')
//   .option('-m, --mint <string>', 'Mint of the token to purchase')
//   .option('-t, --token-size <string>', 'Amount of tokens you want to sell')
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   .action(async (directory, cmd) => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars

//ts-node src/auction-house-cli.ts sell \
// -k ~/mywallet.key \
// -ah HsKwc8dQtm8KLxshw67dwsNePkH6wMXo5Lwn1FuKjVYVS \
// --buy-price 1 \
// --mint F7fejo7cT1fRyJxj1W2aWy3aeJz8iqLU9YvbBAzwJGh2 \
// --token-size 1

//wallet public key: CCJC2s8FDGAs8GqmngE9gviusEuNnkdUwchcYMZ8ZmHB
// wallet public key: DCDcpZaJUghstQNMHy9VAPnwQe1cGsHq7fbeqkti4kM3
// Set 1 F7fejo7cT1fRyJxj1W2aWy3aeJz8iqLU9YvbBAzwJGh2 for sale for 1 from your account with Auction House Ee53kiwLVw5XG98gSLNHoQRi4J22XEhz3zsKYY2ttsb7


export const sell = async (directory: any, cmd: any) => {
    const {
        keypair,
        env,
        auctionHouse,
        auctionHouseKeypair,
        buyPrice,
        mint,
        tokenSize,
        auctionHouseSigns,
    } = cmd.opts();

    const auctionHouseKey = new web3.PublicKey(auctionHouse);
    const walletKeyPair = loadWalletKey(keypair);

    const mintKey = new web3.PublicKey(mint);

    const auctionHouseKeypairLoaded:any = auctionHouseKeypair
        ? loadWalletKey(auctionHouseKeypair)
        : null;
    const anchorProgram = await loadAuctionHouseProgram(
        auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
        env,
    );
    const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
        auctionHouseKey,
    );

    const buyPriceAdjusted = new BN(
        await getPriceWithMantissa(
            buyPrice,
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            walletKeyPair,
            anchorProgram,
        ),
    );

    const tokenSizeAdjusted = new BN(
        await getPriceWithMantissa(
            tokenSize,
            mintKey,
            walletKeyPair,
            anchorProgram,
        ),
    );

    const tokenAccountKey = (
        await getAtaForMint(mintKey, walletKeyPair.publicKey)
    )[0];

    const [programAsSigner, programAsSignerBump] =
        await getAuctionHouseProgramAsSigner();
    // const metadata = await getMetadata(mintKey);

    const [tradeState, tradeBump] = await getAuctionHouseTradeState(
        auctionHouseKey,
        walletKeyPair.publicKey,
        tokenAccountKey,
        //@ts-ignore
        auctionHouseObj.treasuryMint,
        mintKey,
        tokenSizeAdjusted,
        buyPriceAdjusted,
    );

    const [freeTradeState, freeTradeBump] = await getAuctionHouseTradeState(
        auctionHouseKey,
        walletKeyPair.publicKey,
        tokenAccountKey,
        //@ts-ignore
        auctionHouseObj.treasuryMint,
        mintKey,
        tokenSizeAdjusted,
        new BN(0),
    );

    const signers: any[] = [];

    const instruction = await anchorProgram.instruction.sell(
        tradeBump,
        freeTradeBump,
        programAsSignerBump,
        buyPriceAdjusted,
        tokenSizeAdjusted,
        {
            accounts: {
                wallet: walletKeyPair.publicKey,
                metadata: await getMetadata(mintKey),
                tokenAccount: tokenAccountKey,
                //@ts-ignore
                authority: auctionHouseObj.authority,
                auctionHouse: auctionHouseKey,
                //@ts-ignore
                auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
                sellerTradeState: tradeState,
                freeSellerTradeState: freeTradeState,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                programAsSigner,
                rent: web3.SYSVAR_RENT_PUBKEY,
            },
            signers,
        },
    );

    if (auctionHouseKeypairLoaded) {
        signers.push(auctionHouseKeypairLoaded);

        instruction.keys
            .filter((k: any) => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
            .map((k: any) => (k.isSigner = true));
    }

    if (!auctionHouseSigns) {
        instruction.keys
            .filter((k: any) => k.pubkey.equals(walletKeyPair.publicKey))
            .map((k: any) => (k.isSigner = true));
    }

    await sendTransactionWithRetryWithKeypair(
        anchorProgram.provider.connection,
        auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
        [instruction],
        signers,
        'max',
    );

    // log.info(
    console.log(
        'Set',
        tokenSize,
        mint,
        'for sale for',
        buyPrice,
        'from your account with Auction House',
        auctionHouse,
    );
};

// programCommand('withdraw_from_treasury')
//   .option(
//     '-tm, --treasury-mint <string>',
//     'Optional. Mint address of treasury. If not used, default to SOL. Ignored if providing -ah arg',
//   )
//   .option(
//     '-ah, --auction-house <string>',
//     'Specific auction house(if not provided, we assume you are asking for your own)',
//   )
//   .option('-a, --amount <string>', 'Amount to withdraw')
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   .action(async (directory, cmd) => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const withdraw_from_treasury = async (directory: any, cmd: any) => {
    const { keypair, env, auctionHouse, treasuryMint, amount } = cmd.opts();

    const walletKeyPair = loadWalletKey(keypair);

    const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);

    let tMintKey;
    if (!treasuryMint) {
        //   log.info('No treasury mint detected, using SOL.');
        console.log('No treasury mint detected, using SOL.');
        tMintKey = WRAPPED_SOL_MINT;
    } else {
        tMintKey = new web3.PublicKey(treasuryMint);
    }

    const auctionHouseKey = await getAuctionHouseFromOpts(
        auctionHouse,
        walletKeyPair,
        tMintKey,
    );

    const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
        auctionHouseKey,
    );

    const amountAdjusted = new BN(
        await getPriceWithMantissa(
            amount,
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            walletKeyPair,
            anchorProgram,
        ),
    );
    const signers: any = [];

    const instruction = await anchorProgram.instruction.withdrawFromTreasury(
        amountAdjusted,
        {
            accounts: {
                //@ts-ignore
                treasuryMint: auctionHouseObj.treasuryMint,
                //@ts-ignore
                authority: auctionHouseObj.authority,
                treasuryWithdrawalDestination:
                    //@ts-ignore
                    auctionHouseObj.treasuryWithdrawalDestination,
                //@ts-ignore
                auctionHouseTreasury: auctionHouseObj.auctionHouseTreasury,
                auctionHouse: auctionHouseKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
            },
            signers,
        },
    );

    await sendTransactionWithRetryWithKeypair(
        anchorProgram.provider.connection,
        walletKeyPair,
        [instruction],
        signers,
        'max',
    );

    // log.info(
    console.log(
        'Withdrew',
        amountAdjusted.toNumber(),
        'from your account with Auction House',
        auctionHouse,
    );
};

// programCommand('withdraw_from_fees')
//   .option(
//     '-tm, --treasury-mint <string>',
//     'Optional. Mint address of treasury. If not used, default to SOL. Ignored if providing -ah arg',
//   )
//   .option(
//     '-ah, --auction-house <string>',
//     'Specific auction house(if not provided, we assume you are asking for your own)',
//   )
//   .option('-a, --amount <string>', 'Amount to withdraw')
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   .action(async (directory, cmd) => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const withdraw_from_fees = async (directory: any, cmd: any) => {
    const { keypair, env, auctionHouse, treasuryMint, amount } = cmd.opts();

    const walletKeyPair = loadWalletKey(keypair);

    const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);

    let tMintKey;
    if (!treasuryMint) {
        //   log.info('No treasury mint detected, using SOL.');
        console.log('No treasury mint detected, using SOL.');
        tMintKey = WRAPPED_SOL_MINT;
    } else {
        tMintKey = new web3.PublicKey(treasuryMint);
    }

    const auctionHouseKey = await getAuctionHouseFromOpts(
        auctionHouse,
        walletKeyPair,
        tMintKey,
    );

    const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
        auctionHouseKey,
    );

    const amountAdjusted = new BN(
        await getPriceWithMantissa(
            amount,
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            walletKeyPair,
            anchorProgram,
        ),
    );
    const signers: any = [];

    const instruction = await anchorProgram.instruction.withdrawFromFee(
        amountAdjusted,
        {
            accounts: {
                //@ts-ignore
                authority: auctionHouseObj.authority,
                feeWithdrawalDestination:
                    //@ts-ignore
                    auctionHouseObj.feeWithdrawalDestination,
                //@ts-ignore
                auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
                auctionHouse: auctionHouseKey,
                systemProgram: web3.SystemProgram.programId,
            },
            signers,
        },
    );

    await sendTransactionWithRetryWithKeypair(
        anchorProgram.provider.connection,
        walletKeyPair,
        [instruction],
        signers,
        'max',
    );

    // log.info(
    console.log(
        'Withdrew',
        amountAdjusted.toNumber(),
        'from your account with Auction House',
        auctionHouse,
    );
};

// programCommand('cancel')
//   .option('-ah, --auction-house <string>', 'Specific auction house')
//   .option(
//     '-ak, --auction-house-keypair <string>',
//     'If this auction house requires sign off, pass in keypair for it',
//   )
//   .option(
//     '-aks, --auction-house-signs',
//     'If you want to simulate the auction house changing the price without your sign off',
//   )
//   .option('-b, --buy-price <string>', 'Price you wish to sell for')
//   .option('-m, --mint <string>', 'Mint of the token to purchase')
//   .option('-t, --token-size <string>', 'Amount of tokens you want to sell')
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   .action(async (directory, cmd) => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const cancel = async (directory: any, cmd: any) => {
    const {
        keypair,
        env,
        auctionHouse,
        auctionHouseKeypair,
        buyPrice,
        mint,
        tokenSize,
        auctionHouseSigns,
    } = cmd.opts();

    const auctionHouseKey = new web3.PublicKey(auctionHouse);
    const walletKeyPair = loadWalletKey(keypair);

    const mintKey = new web3.PublicKey(mint);

    const auctionHouseKeypairLoaded:any = auctionHouseKeypair
        ? loadWalletKey(auctionHouseKeypair)
        : null;
    const anchorProgram = await loadAuctionHouseProgram(
        auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
        env,
    );
    const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
        auctionHouseKey,
    );

    const buyPriceAdjusted = new BN(
        await getPriceWithMantissa(
            buyPrice,
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            walletKeyPair,
            anchorProgram,
        ),
    );

    const tokenSizeAdjusted = new BN(
        await getPriceWithMantissa(
            tokenSize,
            mintKey,
            walletKeyPair,
            anchorProgram,
        ),
    );

    const tokenAccountKey = (
        await getAtaForMint(mintKey, walletKeyPair.publicKey)
    )[0];

    const tradeState = (
        await getAuctionHouseTradeState(
            auctionHouseKey,
            walletKeyPair.publicKey,
            tokenAccountKey,
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            mintKey,
            tokenSizeAdjusted,
            buyPriceAdjusted,
        )
    )[0];

    const signers: any = [];

    const instruction = await anchorProgram.instruction.cancel(
        buyPriceAdjusted,
        tokenSizeAdjusted,
        {
            accounts: {
                wallet: walletKeyPair.publicKey,
                tokenAccount: tokenAccountKey,
                tokenMint: mintKey,
                //@ts-ignore
                authority: auctionHouseObj.authority,
                auctionHouse: auctionHouseKey,
                //@ts-ignore
                auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
                tradeState,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers,
        },
    );

    if (auctionHouseKeypairLoaded) {
        signers.push(auctionHouseKeypairLoaded);

        instruction.keys
            .filter((k: any) => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
            .map((k: any) => (k.isSigner = true));
    }

    if (!auctionHouseSigns) {
        instruction.keys
            .filter((k: any) => k.pubkey.equals(walletKeyPair.publicKey))
            .map((k: any) => (k.isSigner = true));
    }

    await sendTransactionWithRetryWithKeypair(
        anchorProgram.provider.connection,
        auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
        [instruction],
        signers,
        'max',
    );

    // log.info(
    console.log(
        'Cancelled buy or sale of',
        tokenSize,
        mint,
        'for',
        buyPrice,
        'from your account with Auction House',
        auctionHouse,
    );
};

// programCommand('execute_sale')
//   .option('-ah, --auction-house <string>', 'Specific auction house')
//   .option(
//     '-ak, --auction-house-keypair <string>',
//     'If this auction house requires sign off, pass in keypair for it',
//   )
//   .option(
//     '-aks, --auction-house-signs',
//     'If you want to simulate the auction house executing the sale without another signer',
//   )
//   .option('-b, --buy-price <string>', 'Price you wish to sell for')
//   .option('-m, --mint <string>', 'Mint of the token to purchase')
//   .option('-t, --token-size <string>', 'Amount of tokens you want to sell')
//   .option('-bw, --buyer-wallet <string>', 'Buyer wallet')
//   .option('-sw, --seller-wallet <string>', 'Buyer wallet')
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   .action(async (directory, cmd) => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars

//$ ts-node src/auction-house-cli.ts execute_sale 
// -k ~/mywallet.key \
// -ah HsKwc8dQtm8KLxshw67dwsNePkH6wMXo5Lwn1FuKjVYVS \
// --buy-price 2 \
// --mint DCqt9QQ3ot3qv53EhWrYAWFuh4XgSvFJvLRjgsDnhLTp \
// --buyer-wallet 3DikCrEsfAVHv9rXENg2Hdmc16L71EjveQEF4NbSfRak \
// --seller-wallet CCJC2s8FDGAs8GqmngE9gviusEuNnkdUwchcYMZ8ZmHB \
// --token-size 1
// wallet public key: CCJC2s8FDGAs8GqmngE9gviusEuNnkdUwchcYMZ8ZmHB
// wallet public key: DCDcpZaJUghstQNMHy9VAPnwQe1cGsHq7fbeqkti4kM3
// Accepted 1 DCqt9QQ3ot3qv53EhWrYAWFuh4XgSvFJvLRjgsDnhLTp sale from wallet CCJC2s8FDGAs8GqmngE9gviusEuNnkdUwchcYMZ8ZmHB to 3DikCrEsfAVHv9rXENg2Hdmc16L71EjveQEF4NbSfRak for 2 from your account with Auction House HsKwc8dQtm8KLxshw67dwsNePkH6wMXo5Lwn1FuKjVYVS

export const execute_sale = async (directory: any, cmd: any) => {
    const {
        keypair,
        env,
        auctionHouse,
        auctionHouseKeypair,
        buyPrice,
        mint,
        tokenSize,
        auctionHouseSigns,
        buyerWallet,
        sellerWallet,
    } = cmd.opts();

    const auctionHouseKey = new web3.PublicKey(auctionHouse);
    const walletKeyPair = loadWalletKey(keypair);

    const mintKey = new web3.PublicKey(mint);

    const auctionHouseKeypairLoaded:any = auctionHouseKeypair
        ? loadWalletKey(auctionHouseKeypair)
        : null;
    const anchorProgram = await loadAuctionHouseProgram(
        auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
        env,
    );
    const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
        auctionHouseKey,
    );
    const buyerWalletKey = new web3.PublicKey(buyerWallet);
    const sellerWalletKey = new web3.PublicKey(sellerWallet);

    //@ts-ignore
    const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);
    const buyPriceAdjusted = new BN(
        await getPriceWithMantissa(
            buyPrice,
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            walletKeyPair,
            anchorProgram,
        ),
    );

    const tokenSizeAdjusted = new BN(
        await getPriceWithMantissa(
            tokenSize,
            mintKey,
            walletKeyPair,
            anchorProgram,
        ),
    );

    const tokenAccountKey = (await getAtaForMint(mintKey, sellerWalletKey))[0];

    const buyerTradeState = (
        await getAuctionHouseTradeState(
            auctionHouseKey,
            buyerWalletKey,
            tokenAccountKey,
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            mintKey,
            tokenSizeAdjusted,
            buyPriceAdjusted,
        )
    )[0];

    const sellerTradeState = (
        await getAuctionHouseTradeState(
            auctionHouseKey,
            sellerWalletKey,
            tokenAccountKey,
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            mintKey,
            tokenSizeAdjusted,
            buyPriceAdjusted,
        )
    )[0];

    const [freeTradeState, freeTradeStateBump] =
        await getAuctionHouseTradeState(
            auctionHouseKey,
            sellerWalletKey,
            tokenAccountKey,
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            mintKey,
            tokenSizeAdjusted,
            new BN(0),
        );
    const [escrowPaymentAccount, bump] = await getAuctionHouseBuyerEscrow(
        auctionHouseKey,
        buyerWalletKey,
    );
    const [programAsSigner, programAsSignerBump] =
        await getAuctionHouseProgramAsSigner();
    const metadata = await getMetadata(mintKey);

    const metadataObj:any = await anchorProgram.provider.connection.getAccountInfo(
        metadata,
    );
    const metadataDecoded: any = decodeMetadata(
        Buffer.from(metadataObj.data),
    );

    const remainingAccounts = [];

    for (let i = 0; i < metadataDecoded?.data.creators.length; i++) {
        remainingAccounts.push({
            pubkey: new web3.PublicKey(metadataDecoded.data.creators[i].address),
            isWritable: true,
            isSigner: false,
        });
        if (!isNative) {
            remainingAccounts.push({
                pubkey: (
                    await getAtaForMint(
                        //@ts-ignore
                        auctionHouseObj.treasuryMint,
                        remainingAccounts[remainingAccounts.length - 1].pubkey,
                    )
                )[0],
                isWritable: true,
                isSigner: false,
            });
        }
    }
    const signers: any = [];
    //@ts-ignore
    const tMint: web3.PublicKey = auctionHouseObj.treasuryMint;

    const instruction = await anchorProgram.instruction.executeSale(
        bump,
        freeTradeStateBump,
        programAsSignerBump,
        buyPriceAdjusted,
        tokenSizeAdjusted,
        {
            accounts: {
                buyer: buyerWalletKey,
                seller: sellerWalletKey,
                metadata,
                tokenAccount: tokenAccountKey,
                tokenMint: mintKey,
                escrowPaymentAccount,
                treasuryMint: tMint,
                sellerPaymentReceiptAccount: isNative
                    ? sellerWalletKey
                    : (
                        await getAtaForMint(tMint, sellerWalletKey)
                    )[0],
                buyerReceiptTokenAccount: (
                    await getAtaForMint(mintKey, buyerWalletKey)
                )[0],
                //@ts-ignore
                authority: auctionHouseObj.authority,
                auctionHouse: auctionHouseKey,
                //@ts-ignore
                auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
                //@ts-ignore
                auctionHouseTreasury: auctionHouseObj.auctionHouseTreasury,
                sellerTradeState,
                buyerTradeState,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                programAsSigner,
                rent: web3.SYSVAR_RENT_PUBKEY,
                freeTradeState,
            },
            remainingAccounts,
            signers,
        },
    );

    if (auctionHouseKeypairLoaded) {
        signers.push(auctionHouseKeypairLoaded);

        instruction.keys
            .filter((k: any) => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
            .map((k: any) => (k.isSigner = true));
    }

    if (!auctionHouseSigns) {
        instruction.keys
            .filter((k: any) => k.pubkey.equals(walletKeyPair.publicKey))
            .map((k: any) => (k.isSigner = true));
    }

    await sendTransactionWithRetryWithKeypair(
        anchorProgram.provider.connection,
        auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
        [instruction],
        signers,
        'max',
    );

    // log.info(
    console.log(
        'Accepted',
        tokenSize,
        mint,
        'sale from wallet',
        sellerWalletKey.toBase58(),
        'to',
        buyerWalletKey.toBase58(),
        'for',
        buyPrice,
        'from your account with Auction House',
        auctionHouse,
    );
};

// programCommand('buy')
//   .option('-ah, --auction-house <string>', 'Specific auction house')
//   .option(
//     '-ak, --auction-house-keypair <string>',
//     'If this auction house requires sign off, pass in keypair for it',
//   )
//   .option('-b, --buy-price <string>', 'Price you wish to purchase for')
//   .option('-m, --mint <string>', 'Mint of the token to purchase')
//   .option(
//     '-ta, --token-account <string>',
//     'Token account of the token to purchase - defaults to finding the one with highest balance (for NFTs)',
//   )
//   .option('-t, --token-size <string>', 'Amount of tokens you want to purchase')
// eslint-disable-next-line @typescript-eslint/no-unused-vars
//   .action(async (directory: any, cmd: any) => {
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars

//ts-node src/auction-house-cli.ts buy \
// -k ~/mywallet.key \
// -ah HsKwc8dQtm8KLxshw67dwsNePkH6wMXo5Lwn1FuKjVYVS \
// --buy-price 2 \
// --token-size 1 \
// --mint 7v8kcqCHLih31bp2xwMojGWTMdrcFfzZsYXNbiLiRYgE
// wallet public key: 3DikCrEsfAVHv9rXENg2Hdmc16L71EjveQEF4NbSfRak
// wallet public key: DCDcpZaJUghstQNMHy9VAPnwQe1cGsHq7fbeqkti4kM3
// Made offer for  2

export const buy = async (directory: any, cmd: any) => {
    const {
        keypair,
        env,
        auctionHouse,
        auctionHouseKeypair,
        buyPrice,
        mint,
        tokenSize,
        tokenAccount,
    } = cmd.opts();

    const auctionHouseKey = new web3.PublicKey(auctionHouse);
    const walletKeyPair = loadWalletKey(keypair);

    const mintKey = new web3.PublicKey(mint);

    const auctionHouseKeypairLoaded = auctionHouseKeypair
        ? loadWalletKey(auctionHouseKeypair)
        : null;
    const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);
    const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
        auctionHouseKey,
    );

    const buyPriceAdjusted = new BN(
        await getPriceWithMantissa(
            buyPrice,
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            walletKeyPair,
            anchorProgram,
        ),
    );

    const tokenSizeAdjusted = new BN(
        await getPriceWithMantissa(
            tokenSize,
            mintKey,
            walletKeyPair,
            anchorProgram,
        ),
    );

    const [escrowPaymentAccount, escrowBump] = await getAuctionHouseBuyerEscrow(
        auctionHouseKey,
        walletKeyPair.publicKey,
    );

    const results =
        await anchorProgram.provider.connection.getTokenLargestAccounts(mintKey);

    const tokenAccountKey: web3.PublicKey = tokenAccount
        ? new web3.PublicKey(tokenAccount)
        : results.value[0].address;

    const [tradeState, tradeBump] = await getAuctionHouseTradeState(
        auctionHouseKey,
        walletKeyPair.publicKey,
        tokenAccountKey,
        //@ts-ignore
        auctionHouseObj.treasuryMint,
        mintKey,
        tokenSizeAdjusted,
        buyPriceAdjusted,
    );

    //@ts-ignore
    const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);

    const ata = (
        await getAtaForMint(
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            walletKeyPair.publicKey,
        )
    )[0];
    const transferAuthority = web3.Keypair.generate();
    const signers = isNative ? [] : [transferAuthority];
    const instruction = await anchorProgram.instruction.buy(
        tradeBump,
        escrowBump,
        buyPriceAdjusted,
        tokenSizeAdjusted,
        {
            accounts: {
                wallet: walletKeyPair.publicKey,
                paymentAccount: isNative ? walletKeyPair.publicKey : ata,
                transferAuthority: isNative
                    ? web3.SystemProgram.programId
                    : transferAuthority.publicKey,
                metadata: await getMetadata(mintKey),
                tokenAccount: tokenAccountKey,
                escrowPaymentAccount,
                //@ts-ignore
                treasuryMint: auctionHouseObj.treasuryMint,
                //@ts-ignore
                authority: auctionHouseObj.authority,
                auctionHouse: auctionHouseKey,
                //@ts-ignore
                auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
                buyerTradeState: tradeState,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                rent: web3.SYSVAR_RENT_PUBKEY,
            },
        },
    );

    if (auctionHouseKeypairLoaded) {
        signers.push(auctionHouseKeypairLoaded);

        instruction.keys
            .filter((k: any) => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
            .map((k: any) => (k.isSigner = true));
    }

    if (!isNative) {
        instruction.keys
            .filter((k: any) => k.pubkey.equals(transferAuthority.publicKey))
            .map((k: any) => (k.isSigner = true));
    }

    const instructions = [
        ...(isNative
            ? []
            : [
                Token.createApproveInstruction(
                    TOKEN_PROGRAM_ID,
                    ata,
                    transferAuthority.publicKey,
                    walletKeyPair.publicKey,
                    [],
                    buyPriceAdjusted.toNumber(),
                ),
            ]),

        instruction,
        ...(isNative
            ? []
            : [
                Token.createRevokeInstruction(
                    TOKEN_PROGRAM_ID,
                    ata,
                    walletKeyPair.publicKey,
                    [],
                ),
            ]),
    ];
    await sendTransactionWithRetryWithKeypair(
        anchorProgram.provider.connection,
        walletKeyPair,
        instructions,
        signers,
        'max',
    );

    // log.info('Made offer for ', buyPrice);
    console.log('Made offer for ', buyPrice);
};

// programCommand('deposit')
//   .option('-ah, --auction-house <string>', 'Specific auction house')
//   .option(
//     '-ak, --auction-house-keypair <string>',
//     'If this auction house requires sign off, pass in keypair for it',
//   )
//   .option('-a, --amount <string>', 'Amount to deposit')
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   .action(async (directory, cmd) => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const deposit = async (directory: any, cmd: any) => {
    const { keypair, env, amount, auctionHouse, auctionHouseKeypair } =
        cmd.opts();
    const auctionHouseKey = new web3.PublicKey(auctionHouse);
    const walletKeyPair = loadWalletKey(keypair);

    const auctionHouseKeypairLoaded = auctionHouseKeypair
        ? loadWalletKey(auctionHouseKeypair)
        : null;
    const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);
    const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
        auctionHouseKey,
    );
    const amountAdjusted = await getPriceWithMantissa(
        amount,
        //@ts-ignore
        auctionHouseObj.treasuryMint,
        walletKeyPair,
        anchorProgram,
    );
    const [escrowPaymentAccount, bump] = await getAuctionHouseBuyerEscrow(
        auctionHouseKey,
        walletKeyPair.publicKey,
    );

    //@ts-ignore
    const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);

    const ata = (
        await getAtaForMint(
            //@ts-ignore
            auctionHouseObj.treasuryMint,
            walletKeyPair.publicKey,
        )
    )[0];
    const transferAuthority = web3.Keypair.generate();
    const signers = isNative ? [] : [transferAuthority];
    const instruction = await anchorProgram.instruction.deposit(
        bump,
        new BN(amountAdjusted),
        {
            accounts: {
                wallet: walletKeyPair.publicKey,
                paymentAccount: isNative ? walletKeyPair.publicKey : ata,
                transferAuthority: isNative
                    ? web3.SystemProgram.programId
                    : transferAuthority.publicKey,
                escrowPaymentAccount,
                //@ts-ignore
                treasuryMint: auctionHouseObj.treasuryMint,
                //@ts-ignore
                authority: auctionHouseObj.authority,
                auctionHouse: auctionHouseKey,
                //@ts-ignore
                auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                rent: web3.SYSVAR_RENT_PUBKEY,
            },
        },
    );

    if (auctionHouseKeypairLoaded) {
        signers.push(auctionHouseKeypairLoaded);

        instruction.keys
            .filter((k: any) => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
            .map((k: any) => (k.isSigner = true));
    }

    if (!isNative) {
        instruction.keys
            .filter((k: any) => k.pubkey.equals(transferAuthority.publicKey))
            .map((k: any) => (k.isSigner = true));
    }

    const currBal = await getTokenAmount(
        anchorProgram,
        escrowPaymentAccount,
        //@ts-ignore
        auctionHouseObj.treasuryMint,
    );

    const instructions = [
        ...(isNative
            ? []
            : [
                Token.createApproveInstruction(
                    TOKEN_PROGRAM_ID,
                    ata,
                    transferAuthority.publicKey,
                    walletKeyPair.publicKey,
                    [],
                    amountAdjusted,
                ),
            ]),

        instruction,
        ...(isNative
            ? []
            : [
                Token.createRevokeInstruction(
                    TOKEN_PROGRAM_ID,
                    ata,
                    walletKeyPair.publicKey,
                    [],
                ),
            ]),
    ];
    await sendTransactionWithRetryWithKeypair(
        anchorProgram.provider.connection,
        walletKeyPair,
        instructions,
        signers,
        'max',
    );

    // log.info(
    console.log(
        'Deposited ',
        amountAdjusted,
        'to your account with Auction House',
        auctionHouse,
        '. New Balance:',
        currBal + amountAdjusted,
    );
};

// programCommand('show')
//   .option(
//     '-tm, --treasury-mint <string>',
//     'Optional. Mint address of treasury. If not used, default to SOL. Ignored if providing -ah arg',
//   )
//   .option(
//     '-ah, --auction-house <string>',
//     'Specific auction house(if not provided, we assume you are asking for your own)',
//   )
//   .action(async (directory, cmd) => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars

//ts-node src/auction-house-cli.ts show -k ~/mywallet.key -ah HsKwc8dQtm8KLxshw67dwsNePkH6wMXo5Lwn1FuKjVYVS

// No treasury mint detected, using SOL.
// -----
// Auction House: HsKwc8dQtm8KLxshw67dwsNePkH6wMXo5Lwn1FuKjVYVS
// Mint: So11111111111111111111111111111111111111112
// Authority: DCDcpZaJUghstQNMHy9VAPnwQe1cGsHq7fbeqkti4kM3
// Creator: DCDcpZaJUghstQNMHy9VAPnwQe1cGsHq7fbeqkti4kM3
// Fee Payer Acct: AcWpR41NPMq73FZUspCiXxoLrJnW7zytgHKY5xqtETkU
// Treasury Acct: HFW5CY73qN3XK3qEP7ZFxbpBBkQtipPfPQzaDj3mbbY1
// Fee Payer Withdrawal Acct: DCDcpZaJUghstQNMHy9VAPnwQe1cGsHq7fbeqkti4kM3
// Treasury Withdrawal Acct: DCDcpZaJUghstQNMHy9VAPnwQe1cGsHq7fbeqkti4kM3
// Fee Payer Bal: 0
// Treasury Bal: 0
// Seller Fee Basis Points: 1000
// Requires Sign Off: false
// Can Change Sale Price: false
// AH Bump: 255
// AH Fee Bump: 252
// AH Treasury Bump: 254


export const show = async (directory: any, cmd: any) => {
    const { keypair, env, auctionHouse, treasuryMint } = cmd.opts();

    const walletKeyPair = loadWalletKey(keypair);
    const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);
    let tMintKey;
    if (!treasuryMint) {
        //   log.info('No treasury mint detected, using SOL.');
        console.log('No treasury mint detected, using SOL.');
        tMintKey = WRAPPED_SOL_MINT;
    } else {
        tMintKey = new web3.PublicKey(treasuryMint);
    }

    const auctionHouseKey = await getAuctionHouseFromOpts(
        auctionHouse,
        walletKeyPair,
        tMintKey,
    );

    const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
        auctionHouseKey,
    );

    const treasuryAmount = await getTokenAmount(
        anchorProgram,
        //@ts-ignore
        auctionHouseObj.auctionHouseTreasury,
        //@ts-ignore
        auctionHouseObj.treasuryMint,
    );

    const feeAmount = await anchorProgram.provider.connection.getBalance(
        //@ts-ignore
        auctionHouseObj.auctionHouseFeeAccount,
    );

    // log.info('-----');
    console.log('-----');
    // log.info('Auction House:', auctionHouseKey.toBase58());
    console.log('Auction House:', auctionHouseKey.toBase58());
    //@ts-ignore
    // log.info('Mint:', auctionHouseObj.treasuryMint.toBase58());
    console.log('Mint:', auctionHouseObj.treasuryMint.toBase58());
    //@ts-ignore
    // log.info('Authority:', auctionHouseObj.authority.toBase58());
    console.log('Authority:', auctionHouseObj.authority.toBase58());
    //@ts-ignore
    // log.info('Creator:', auctionHouseObj.creator.toBase58());
    console.log('Creator:', auctionHouseObj.creator.toBase58());
    // log.info(
    console.log(
        'Fee Payer Acct:',
        //@ts-ignore
        auctionHouseObj.auctionHouseFeeAccount.toBase58(),
    );
    //@ts-ignore
    // log.info('Treasury Acct:', auctionHouseObj.auctionHouseTreasury.toBase58());
    console.log('Treasury Acct:', auctionHouseObj.auctionHouseTreasury.toBase58());
    // log.info(
    console.log(
        'Fee Payer Withdrawal Acct:',
        //@ts-ignore
        auctionHouseObj.feeWithdrawalDestination.toBase58(),
    );
    // log.info(
    console.log(
        'Treasury Withdrawal Acct:',
        //@ts-ignore
        auctionHouseObj.treasuryWithdrawalDestination.toBase58(),
    );

    // log.info('Fee Payer Bal:', feeAmount);
    console.log('Fee Payer Bal:', feeAmount);
    // log.info('Treasury Bal:', treasuryAmount);
    console.log('Treasury Bal:', treasuryAmount);
    //@ts-ignore
    // log.info('Seller Fee Basis Points:', auctionHouseObj.sellerFeeBasisPoints);
    console.log('Seller Fee Basis Points:', auctionHouseObj.sellerFeeBasisPoints);
    //@ts-ignore
    // log.info('Requires Sign Off:', auctionHouseObj.requiresSignOff);
    console.log('Requires Sign Off:', auctionHouseObj.requiresSignOff);
    //@ts-ignore
    // log.info('Can Change Sale Price:', auctionHouseObj.canChangeSalePrice);
    console.log('Can Change Sale Price:', auctionHouseObj.canChangeSalePrice);
    //@ts-ignore
    // log.info('AH Bump:', auctionHouseObj.bump);
    console.log('AH Bump:', auctionHouseObj.bump);
    //@ts-ignore
    // log.info('AH Fee Bump:', auctionHouseObj.feePayerBump);
    console.log('AH Fee Bump:', auctionHouseObj.feePayerBump);
    //@ts-ignore
    // log.info('AH Treasury Bump:', auctionHouseObj.treasuryBump);
    console.log('AH Treasury Bump:', auctionHouseObj.treasuryBump);
};

// programCommand('create_auction_house')
//   .option(
//     '-tm, --treasury-mint <string>',
//     'Mint address of treasury. If not used, default to SOL.',
//   )
//   .option(
//     '-sfbp, --seller-fee-basis-points <string>',
//     'Auction house cut of each txn, 10000 = 100%',
//   )
//   .option(
//     '-ccsp, --can-change-sale-price <string>',
//     'if true, and user initially places item for sale for 0, then AH can make new sell prices without consent(off chain price matching). Should only be used in concert with requires-sign-off, so AH is controlling every txn hitting the system.',
//   )
//   .option(
//     '-rso, --requires-sign-off <string>',
//     'if true, no txn can occur against this Auction House without AH authority as signer. Good if you are doing all txns through a pass-through GCP or something.',
//   )
//   .option(
//     '-twd, --treasury-withdrawal-destination <string>',
//     'if you wish to empty the treasury account, this is where it will land, default is your keypair. Pass in a wallet, not an ATA - ATA will be made for you if not present.',
//   )
//   .option(
//     '-fwd, --fee-withdrawal-destination <string>',
//     'if you wish to empty the fee paying account, this is where it will land, default is your keypair',
//   )
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   .action(async (directory, cmd) => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars

//ts-node src/auction-house-cli.ts create_auction_house --keypair ~/mywallet.key -e devnet -sfbp 1000 -ccsp false -rso false

// wallet public key: Gsv13oph2i6nkJvNkVfuzkcbHWchz6viUtEg2vsxQMtM
// No treasury withdrawal dest detected, using keypair
// No fee withdrawal dest detected, using keypair
// No treasury mint detected, using SOL.
// Created auction house HsKwc8dQtm8KLxshw67dwsNePkH6wMXo5Lwn1FuKjVYVS <--- Your auction house key will be different 

export const create_auction_house = async (directory: any, cmd: any) => {
    const {
        keypair,
        env,
        sellerFeeBasisPoints,
        canChangeSalePrice,
        requiresSignOff,
        treasuryWithdrawalDestination,
        feeWithdrawalDestination,
        treasuryMint,
    } = cmd.opts();

    const sfbp = parseInt(sellerFeeBasisPoints);

    const walletKeyPair = loadWalletKey(keypair);
    const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);

    let twdKey: web3.PublicKey,
        fwdKey: web3.PublicKey,
        tMintKey: web3.PublicKey;
    if (!treasuryWithdrawalDestination) {
        //   log.info('No treasury withdrawal dest detected, using keypair');
        console.log('No treasury withdrawal dest detected, using keypair');
        twdKey = walletKeyPair.publicKey;
    } else {
        twdKey = new web3.PublicKey(treasuryWithdrawalDestination);
    }
    if (!feeWithdrawalDestination) {
        //   log.info('No fee withdrawal dest detected, using keypair');
        console.log('No fee withdrawal dest detected, using keypair');
        fwdKey = walletKeyPair.publicKey;
    } else {
        fwdKey = new web3.PublicKey(feeWithdrawalDestination);
    }
    if (!treasuryMint) {
        //   log.info('No treasury mint detected, using SOL.');
        console.log('No treasury mint detected, using SOL.');
        tMintKey = WRAPPED_SOL_MINT;
    } else {
        tMintKey = new web3.PublicKey(treasuryMint);
    }
    const twdAta = tMintKey.equals(WRAPPED_SOL_MINT)
        ? twdKey
        : (await getAtaForMint(tMintKey, twdKey))[0];

    const [auctionHouse, bump] = await getAuctionHouse(
        walletKeyPair.publicKey,
        tMintKey,
    );
    const [feeAccount, feeBump] = await getAuctionHouseFeeAcct(auctionHouse);
    const [treasuryAccount, treasuryBump] = await getAuctionHouseTreasuryAcct(
        auctionHouse,
    );

    await anchorProgram.rpc.createAuctionHouse(
        bump,
        feeBump,
        treasuryBump,
        sfbp,
        requiresSignOff == 'true',
        canChangeSalePrice == 'true',
        {
            accounts: {
                treasuryMint: tMintKey,
                payer: walletKeyPair.publicKey,
                authority: walletKeyPair.publicKey,
                feeWithdrawalDestination: fwdKey,
                treasuryWithdrawalDestination: twdAta,
                treasuryWithdrawalDestinationOwner: twdKey,
                auctionHouse,
                auctionHouseFeeAccount: feeAccount,
                auctionHouseTreasury: treasuryAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
                ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                rent: web3.SYSVAR_RENT_PUBKEY,
            },
        },
    );
    // log.info('Created auction house', auctionHouse.toBase58());
    console.log('Created auction house', auctionHouse.toBase58());
};

// programCommand('update_auction_house')
//   .option(
//     '-tm, --treasury-mint <string>',
//     'Mint address of treasury used during creation. If not used, default to SOL. Ignored if providing -ah arg',
//   )
//   .option(
//     '-ah, --auction-house <string>',
//     'Specific auction house(if not provided, we assume you are asking for your own)',
//   )
//   .option(
//     '-a, --new-authority <string>',
//     'New authority of auction house - defaults to current authority',
//   )
//   .option('-f, --force', 'Cannot set authority without this flag being set.')
//   .option(
//     '-sfbp, --seller-fee-basis-points <string>',
//     'Auction house cut of each txn, 10000 = 100%',
//   )
//   .option(
//     '-ccsp, --can-change-sale-price <string>',
//     'if true, and user initially places item for sale for 0, then AH can make new sell prices without consent(off chain price matching). Should only be used in concert with requires-sign-off, so AH is controlling every txn hitting the system.',
//   )
//   .option(
//     '-rso, --requires-sign-off <string>',
//     'if true, no txn can occur against this Auction House without AH authority as signer. Good if you are doing all txns through a pass-through GCP or something.',
//   )
//   .option(
//     '-twd, --treasury-withdrawal-destination <string>',
//     'if you wish to empty the treasury account, this is where it will land, default is your keypair. Pass in a wallet, not an ATA - ATA will be made for you if not present.',
//   )
//   .option(
//     '-fwd, --fee-withdrawal-destination <string>',
//     'if you wish to empty the fee paying account, this is where it will land, default is your keypair',
//   )
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   .action(async (directory, cmd) => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const update_auction_house = async (directory: any, cmd: any) => {
    const {
        keypair,
        env,
        sellerFeeBasisPoints,
        canChangeSalePrice,
        requiresSignOff,
        treasuryWithdrawalDestination,
        feeWithdrawalDestination,
        treasuryMint,
        auctionHouse,
        newAuthority,
        force,
    } = cmd.opts();

    const walletKeyPair = loadWalletKey(keypair);
    const anchorProgram:any = await loadAuctionHouseProgram(walletKeyPair, env);

    let tMintKey: web3.PublicKey;
    if (!treasuryMint) {
        //   log.info('No treasury mint detected, using SOL.');
        console.log('No treasury mint detected, using SOL.');
        tMintKey = WRAPPED_SOL_MINT;
    } else {
        tMintKey = new web3.PublicKey(treasuryMint);
    }

    const auctionHouseKey = await getAuctionHouseFromOpts(
        auctionHouse,
        walletKeyPair,
        tMintKey,
    );
    const auctionHouseObj = await anchorProgram.account.auctionHouse.fetch(
        auctionHouseKey,
    );
    //@ts-ignore
    tMintKey = auctionHouseObj.treasuryMint;

    let twdKey: web3.PublicKey, fwdKey: web3.PublicKey;
    if (!treasuryWithdrawalDestination) {
        //   log.info('No treasury withdrawal dest detected, using original value');
        console.log('No treasury withdrawal dest detected, using original value');
        twdKey = tMintKey.equals(WRAPPED_SOL_MINT)
            ? //@ts-ignore
            auctionHouseObj.treasuryWithdrawalDestination
            : deserializeAccount(
                Buffer.from(
                    (
                        await anchorProgram.provider.connection.getAccountInfo(
                            //@ts-ignore
                            auctionHouseObj.treasuryWithdrawalDestination,
                        )
                    ).data,
                ),
            ).owner;
    } else {
        twdKey = new web3.PublicKey(treasuryWithdrawalDestination);
    }
    if (!feeWithdrawalDestination) {
        //   log.info('No fee withdrawal dest detected, using original value');
        console.log('No fee withdrawal dest detected, using original value');
        //@ts-ignore
        fwdKey = auctionHouseObj.feeWithdrawalDestination;
    } else {
        fwdKey = new web3.PublicKey(feeWithdrawalDestination);
    }
    const twdAta = tMintKey.equals(WRAPPED_SOL_MINT)
        ? twdKey
        : (await getAtaForMint(tMintKey, twdKey))[0];

    let sfbp;
    if (sellerFeeBasisPoints != undefined && sellerFeeBasisPoints != null) {
        sfbp = parseInt(sellerFeeBasisPoints);
    } else {
        //   log.info('No sfbp passed in, using original value');
        console.log('No sfbp passed in, using original value');
        //@ts-ignore
        sfbp = auctionHouseObj.sellerFeeBasisPoints;
    }

    let newAuth;
    if (newAuthority != undefined && newAuthority != null) {
        if (!force) {
            throw Error(
                'Cannot change authority without additional force flag. Are you sure you want to do this?',
            );
        }
        newAuth = newAuthority;
    } else {
        //   log.info('No authority passed in, using original value');
        console.log('No authority passed in, using original value');
        //@ts-ignore
        newAuth = auctionHouseObj.authority;
    }

    let ccsp;
    if (canChangeSalePrice != undefined && canChangeSalePrice != null) {
        ccsp = canChangeSalePrice == 'true';
    } else {
        //   log.info('No can change sale price passed in, using original value');
        console.log('No can change sale price passed in, using original value');
        //@ts-ignore
        ccsp = auctionHouseObj.canChangeSalePrice;
    }

    let rso;
    if (requiresSignOff != undefined && requiresSignOff != null) {
        rso = requiresSignOff == 'true';
    } else {
        //   log.info('No requires sign off passed in, using original value');
        console.log('No requires sign off passed in, using original value');
        //@ts-ignore
        rso = auctionHouseObj.requiresSignOff;
    }
    await anchorProgram.rpc.updateAuctionHouse(sfbp, rso, ccsp, {
        accounts: {
            treasuryMint: tMintKey,
            payer: walletKeyPair.publicKey,
            authority: walletKeyPair.publicKey,
            // extra safety here even though newAuth should be right
            //@ts-ignore
            newAuthority: force ? newAuth : auctionHouseObj.authority,
            feeWithdrawalDestination: fwdKey,
            treasuryWithdrawalDestination: twdAta,
            treasuryWithdrawalDestinationOwner: twdKey,
            auctionHouse: auctionHouseKey,
            //@ts-ignore
            auctionHouseFeeAccount: auctionHouseObj.feePayer,
            //@ts-ignore
            auctionHouseTreasury: auctionHouseObj.treasury,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
            ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: web3.SYSVAR_RENT_PUBKEY,
        },
    });
    // log.info('Updated auction house', auctionHouseKey.toBase58());
    console.log('Updated auction house', auctionHouseKey.toBase58());
};

// function programCommand(name: string) {
//   return program
//     .command(name)
//     .option(
//       '-e, --env <string>',
//       'Solana cluster env name',
//       'devnet', //mainnet-beta, testnet, devnet
//     )
//     .option(
//       '-k, --keypair <path>',
//       `Solana wallet location`,
//       '--keypair not provided',
//     )
//     .option('-l, --log-level <string>', 'log level', setLogLevel);
// }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setLogLevel(value: any, prev: any) {
    if (value === undefined || value === null) {
        return;
    }
    //   log.info('setting the log value to: ' + value);
    console.log('setting the log value to: ' + value);
    //   log.setLevel(value);
}

// program.parse(process.argv);
