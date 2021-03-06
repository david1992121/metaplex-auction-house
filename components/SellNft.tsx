import React, { useState }  from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { AuctionHouseProgram } from '@metaplex-foundation/mpl-auction-house'
import {MetadataProgram} from  '@metaplex-foundation/mpl-token-metadata'
import { Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import BN from 'bn.js'
// import { Nft, Marketplace } from '../../types'

const { createSellInstruction } = AuctionHouseProgram.instructions

const NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");
interface OfferForm {
  amount: string;
}
export interface AuctionHouse {
    address: string;
    treasuryMint: string;
    auctionHouseTreasury: string;
    treasuryWithdrawalDestination: string;
    feeWithdrawalDestination: string;
    authority: string;
    creator: string;
    auction_houseFeeAccount: string;
    bump: number;
    treasuryBump: number;
    feePayerBump: number;
    sellerFeeBasisPoints: number;
    requiresSignOff: boolean;
    canChangeSalePrice: boolean;
  }

export interface NftAttribute {
value: string
traitType: string
}

export interface NftOwner {
address: string
}

export interface Nft {
name: string
address: string
description: string
image: string
sellerFeeBasisPoints: number
mintAddress: string
attributes: NftAttribute[]
owner: NftOwner
}
export interface Marketplace {
    subdomain: string;
    name: string;
    description: string;
    logoUrl: string;
    bannerUrl: string;
    auctionHouse: AuctionHouse;
    ownerAddress: string;
  }
interface OfferProps {
  nft: Nft;
  marketplace: Marketplace;
}

const SellNft = ({ nft, marketplace }: OfferProps) => {
  const { control, watch } = useForm<OfferForm>({})
  const { publicKey, signTransaction } = useWallet()
  const { connection } = useConnection()
  const [sellAmount, setSellAmount] = useState(0)

  const sellNftTransaction = async () => {
    const sellPrice = String(Number(sellAmount) * LAMPORTS_PER_SOL)
    const tokenSize = '1'
    const auctionHouse = new PublicKey(marketplace.auctionHouse.address)
    const authority = new PublicKey(marketplace.auctionHouse.authority)
    const auctionHouseFeeAccount = new PublicKey(marketplace.auctionHouse.auction_houseFeeAccount)

    const tokenMint = new PublicKey(nft.mintAddress)


    if (!publicKey || !signTransaction) {
      return
    }

    const associatedTokenAccount = (
      await AuctionHouseProgram.findAssociatedTokenAccountAddress(tokenMint, new PublicKey(nft.owner.address)) 
    )[0] 


    // Find TradeState Account
    const [
      sellerTradeState,
      tradeStateBump,
    ] = await AuctionHouseProgram.findTradeStateAddress(
      publicKey,
      auctionHouse,
      associatedTokenAccount, 
      NATIVE_MINT,
      tokenMint,
      sellPrice,
      tokenSize
    )

    const [metadata] = await MetadataProgram.findMetadataAccount(tokenMint)

    const [
      programAsSigner,
      programAsSignerBump,
    ] = await AuctionHouseProgram.findAuctionHouseProgramAsSignerAddress()

    const [
      freeTradeState,
      freeTradeBump,
    ]  = await AuctionHouseProgram.findTradeStateAddress(
      auctionHouse,
      publicKey,
      associatedTokenAccount,
      NATIVE_MINT,
      tokenMint,
      String(1),
      String(0)
    )

    // make transaction
    const txt = new Transaction()

    const sellInstructionArgs = {
      tradeStateBump,
      freeTradeStateBump: freeTradeBump,
      programAsSignerBump: programAsSignerBump,
      buyerPrice: new BN(sellPrice),
      tokenSize: new BN(tokenSize),
    }

    const sellInstructionAccounts = {
      wallet: publicKey,
      tokenAccount: associatedTokenAccount,
      metadata: metadata,
      authority: authority,
      auctionHouse: auctionHouse,
      auctionHouseFeeAccount: auctionHouseFeeAccount,
      sellerTradeState: sellerTradeState,
      freeSellerTradeState: freeTradeState,
      programAsSigner: programAsSigner,
    }

    // generate instruction
    const instruction = createSellInstruction(
      sellInstructionAccounts,
      sellInstructionArgs
    )

    // add instruction to tx
    txt.add(instruction)

    // lookup recent block hash and assign fee payer (the current logged in user)
    txt.recentBlockhash = (await connection.getRecentBlockhash()).blockhash
    txt.feePayer = publicKey

    // sign it
    const signed = await signTransaction(txt)

    // submit transaction
    const signature = await connection.sendRawTransaction(signed.serialize())
    await connection.confirmTransaction(signature, 'processed')
  }

  return (
    <form
      className="text-left grow"
      onSubmit={(e) => {
        e.preventDefault();
        sellNftTransaction();
      }
      }>
      <h3 className="mb-6 text-xl font-bold md:text-2xl">Sell this Nft</h3>
      <label className="block mb-1">Price in SOL</label>
      <div className="prefix-input prefix-icon-sol">
        <Controller
          control={control}
          name="amount"
          render={({ field: { onChange, value } }) => {
            const auctionHouseFeeBasisPoints = 200;
            const amount = Number(value || 0) * LAMPORTS_PER_SOL;

            const royalties = (amount * nft.sellerFeeBasisPoints) / 10000;

            const auctionHouseFee = (amount * auctionHouseFeeBasisPoints) / 10000;

            return (
              <>
                <input
                  autoFocus
                  value={value}
                  onChange={(e: any) => {
                    onChange(e.target.value);
                    setSellAmount(e.target.value)
                  }}
                  className="w-full h-10 pl-8 mb-4 text-black bg-transparent border-2 border-gray-500 rounded-md focus:outline-none"
                />
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{nft.sellerFeeBasisPoints / 100}% creator royalty</span>
                    <div className="flex justify-center gap-2">
                      <span className="icon-sol"></span>
                      <span>{royalties / LAMPORTS_PER_SOL}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{auctionHouseFeeBasisPoints / 100}% transaction fee</span>
                    <div className="flex justify-center gap-2">
                      <span className="icon-sol"></span>
                      <span>{auctionHouseFee / LAMPORTS_PER_SOL}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">You receive</span>
                    <div className="flex justify-center gap-2">
                      <span className="icon-sol"></span>
                      <span>{(amount - royalties - auctionHouseFee) / LAMPORTS_PER_SOL}</span>
                    </div>
                  </div>
                </div>
              </>
            )
          }}
        />
      </div>
      <div className="grid flex-grow grid-cols-2 gap-4">
        <Link to={`/nfts/${nft.address}`}>
          <button className="w-full h-12 text-sm text-white transition-colors duration-150 bg-black rounded-full lg:text-xl md:text-base focus:shadow-outline hover:bg-black">Cancel</button>
        </Link>
        <button className="h-12 text-sm text-black transition-colors duration-150 bg-white rounded-full lg:text-xl md:text-base focus:shadow-outline hover:bg-white">List for sale</button>
      </div>
    </form>
  )
};

export default SellNft;