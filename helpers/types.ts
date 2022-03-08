export type ShowEscrow = {
    keypair: any,
    env: any,
    auctionHouse: any,
    wallet: any
};

export type Withdraw = {
    keypair: any,
    env: any,
    amount: any,
    auctionHouse: any,
    auctionHouseKeypair: any
}

export type Sell = {
    keypair: any,
    env: any,
    auctionHouse: any,
    auctionHouseKeypair: any,
    buyPrice: any,
    mint: any,
    tokenSize: any,
    auctionHouseSigns: any,
};

export type WithdrawFromTreasury = {
    keypair: any,
    env: any,
    auctionHouse: any,
    treasuryMint: any,
    amount: any
};
export type WithdrawFromFees = {
    keypair: any,
    env: any,
    auctionHouse: any,
    treasuryMint: any,
    amount: any
};
export type Cancel = {
    keypair: any,
    env: any,
    auctionHouse: any,
    auctionHouseKeypair: any,
    buyPrice: any,
    mint: any,
    tokenSize: any,
    auctionHouseSigns: any
};
export type ExecuteSale = {
    keypair: any,
    env: any,
    auctionHouse: any,
    auctionHouseKeypair: any,
    buyPrice: any,
    mint: any,
    tokenSize: any,
    auctionHouseSigns: any,
    buyerWallet: any,
    sellerWallet: any
};

export type Buy = {
    keypair: any,
    env: any,
    auctionHouse: any,
    auctionHouseKeypair: any,
    buyPrice: any,
    mint: any,
    tokenSize: any,
    tokenAccount: any
};

export type Deposit = {
    keypair: any,
    env: any,
    amount: any,
    auctionHouse: any,
    auctionHouseKeypair: any
}

export type Show = {
    keypair: any,
    env: any,
    auctionHouse: any,
    treasuryMint: any
};

export type CreateAuctionHouse = {
    keypair: any,
    env: any,
    sellerFeeBasisPoints: any,
    canChangeSalePrice: any,
    requiresSignOff: any,
    treasuryWithdrawalDestination: any,
    feeWithdrawalDestination: any,
    treasuryMint: any,
};

export type UpdateAuctionHouse = {
    keypair: any,
    env: any,
    sellerFeeBasisPoints: any,
    canChangeSalePrice: any,
    requiresSignOff: any,
    treasuryWithdrawalDestination: any,
    feeWithdrawalDestination: any,
    treasuryMint: any,
    auctionHouse: any,
    newAuthority: any,
    force: any,
};