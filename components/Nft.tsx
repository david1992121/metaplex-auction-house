import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { Metadata } from '@metaplex-foundation/mpl-token-metadata'
import * as anchor from '@project-serum/anchor'
import {
  Container,
  Box,
  Modal,
  Typography,
  Paper,
  Grid,
  Button,
  TextField,
} from '@material-ui/core'
import styled from 'styled-components'
import { AUCTION_HOUSE_ADDRESS, AUCTION_HOUSE_AUTHORITY, AUCTION_HOUSE_FEE_PAYER as FEE_PAYER } from '../helpers/constants'
import { sell } from '../auction-house'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionInstruction,
  Transaction,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from '@solana/web3.js'
import { AuctionHouseProgram } from '@metaplex-foundation/mpl-auction-house'
import { useForm, Controller } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {MetadataProgram} from  '@metaplex-foundation/mpl-token-metadata'
import BN from 'bn.js'
import { TOKEN_PROGRAM_ID } from '../helpers/constants';

export const NftItem = styled.button`
  &:hover {
    background-color: #ffffff44;
  }
` // add your styles here
// background-color:white;

const style = {
  position: 'absolute',
  borderRadius: '5px',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  bgcolor: '#ffffff',
  boxShadow: 24,
  p: 4,
}

const Img = styled('img')({
  margin: 'auto',
  display: 'block',
  maxWidth: '100%',
  maxHeight: '100%',
})


const { createSellInstruction } = AuctionHouseProgram.instructions

const NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");
interface OfferForm {
  amount: string;
}

// interface OfferProps {
//   nft: Nft;
//   marketplace: Marketplace;
// }

export interface NftProps {
  connection: anchor.web3.Connection
}

export const Nft = (props: NftProps) => {
  const router = useRouter()

  const wallet = useWallet()

  const { connected, publicKey, sendTransaction, signTransaction } = wallet

  const [list, setList] = useState([])

  const [open, setOpen] = useState(false)

  const [selectedItem, setSelectedItem] = useState<any>({})

  const [buyPrice, setBuyPrice] = useState(0)

  const [userInput, setUserInput] = useState<any>({
    minimumBid: '',
    royalties: '',
  })

  useEffect(() => {
    if (wallet.publicKey) {
      nftData()
    }
  }, [wallet.publicKey])

  const handleOpen = (item: any) => {
    console.log(item)
    setSelectedItem(item)
    setOpen(true)
  }
  const handleClose = () => {
    setOpen(false)
    setSelectedItem(null)
    setBuyPrice(0)
  }

  const { control, watch } = useForm<OfferForm>({})
  const { connection } = useConnection()
  const [sellAmount, setSellAmount] = useState(0)

  const sellNftTransaction = async () => {
    const sellPrice = String(Number(sellAmount) * LAMPORTS_PER_SOL);
    const tokenSize = '1';
    const auctionHouseFeeAccount = new PublicKey(FEE_PAYER);
    const auctionHouse = new PublicKey(AUCTION_HOUSE_ADDRESS);
    const authority1 = AUCTION_HOUSE_AUTHORITY;
    const authority = new PublicKey(authority1);
    // const authority = publicKey;

    const tokenMint = new PublicKey(selectedItem.mint);

    if (!publicKey || !signTransaction) {
      debugger;
      return
    }

    const associatedTokenAccount = (
      await AuctionHouseProgram.findAssociatedTokenAccountAddress(tokenMint, publicKey) 
    )[0];

    console.log("wallet key", publicKey);

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
      new BN(sellPrice).toNumber(),
      new BN(tokenSize).toNumber()
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
      publicKey,
      auctionHouse,
      associatedTokenAccount,
      NATIVE_MINT,
      tokenMint,
      0,
      new BN(tokenSize).toNumber()
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

    const sellInstructionAccounts:any = {
      wallet: publicKey,
      tokenAccount: associatedTokenAccount,
      metadata: metadata,
      authority: authority,
      auctionHouse: auctionHouse,
      auctionHouseFeeAccount: auctionHouseFeeAccount,
      sellerTradeState: sellerTradeState,
      freeSellerTradeState: freeTradeState,
      programAsSigner: programAsSigner,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
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
    
    console.log("txt", txt);
    // sign it
    const signed = await signTransaction(txt)

    // submit transaction
    const signature = await connection.sendRawTransaction(signed.serialize())
    await connection.confirmTransaction(signature, 'processed')
  }


  const nftData = async () => {
    const nftsmetadata = await Metadata.findDataByOwner(
      props.connection,
      wallet.publicKey as any,
    )
    console.log('nftsmetadata', nftsmetadata)
    const list: any[] = nftsmetadata.map((item: any) => {
      return { ...item.data, mint: item.mint }
    })

    for (const item of list) {
      console.log('item.uri', item.uri)
      try {
        const response = await fetch(item.uri)
        let { image } = await response.json()

        if (!image.startsWith('http')) {
          image = item.uri + '/' + image
        }

        item.image = image
      } catch (error) {}
    }
    console.log('list', list)
    setList(list as any)
  }
  const anchorWallet = useMemo(() => {
    if (
      !wallet ||
      !wallet.publicKey ||
      !wallet.signAllTransactions ||
      !wallet.signTransaction
    ) {
      return
    }

    return {
      publicKey: wallet.publicKey,
      signAllTransactions: wallet.signAllTransactions,
      signTransaction: wallet.signTransaction,
    } as anchor.Wallet
  }, [wallet])

  const auctionHouseFeeBasisPoints = 200;
  const amount = Number(sellAmount || 0) * LAMPORTS_PER_SOL;
  // const royalties = (amount * nft.sellerFeeBasisPoints) / 10000;
  const royalties = (amount * 500) / 10000;
  const auctionHouseFee = (amount * auctionHouseFeeBasisPoints) / 10000;

  return (
    <div className="bg-container">
      <Container style={{ marginTop: 100 }}>
        <hr />
        {wallet.publicKey ? (
          <div className="flex flex-col w-full mt-4">
            <h2 className="text-2xl font-bold text-center text-white py-4">
              My NFTs
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-start">
              {list.map((item: any, i: any) => (
                <NftItem
                  className="card bordered max-w-xs compact rounded-md text-white p-3 border border-secondary border-5 rounded"
                  key={i}
                  onDoubleClick={() =>
                    // router.push('/post/abc')
                    handleOpen(item)
                  }
                >
                  <figure className="min-h-16 animation-pulse-color">
                    <img
                      className="bg-gray-800 object-cover"
                      src={item.image}
                      alt={item.name}
                    />
                  </figure>
                  <div className="flex justify-between mt-2 card-body">
                    <p>{item.name}</p>
                    <p className="font-bold">{item.symbol}</p>
                  </div>
                </NftItem>
              ))}
            </div>
          </div>
        ) : null}
      </Container>
           <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <Box sx={{ flexGrow: 1 }}>
            <div className="w-full relative flex flex-col bg-primary-200 overflow-hidden shadow-2xl">
              <div className="w-full flex justify-between p-2 text-black">
                <button
                  className="text-black hover:text-secondary text-black"
                  onClick={handleClose}
                >
                  <span className="sr-only">Back</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    className="h-10 w-10"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
                    ></path>
                  </svg>
                </button>
              </div>
              <div className="px-4 pb-8 sm:px-6  lg:px-8">
                <div className="w-full grid grid-cols-1 gap-y-8 gap-x-6 items-start sm:grid-cols-12 lg:gap-x-8">
                  <div className="aspect-w-2 aspect-h-3 rounded-nft overflow-hidden sm:col-span-4 lg:col-span-5">
                    <img
                      src={selectedItem?.image}
                      alt={selectedItem?.name}
                      className="object-center object-cover mx-auto"
                    />
                  </div>
                  <div className="flex flex-col justify-between sm:col-span-8 text-primary lg:col-span-7 h-full ">
                    <h2 className="text-2xl font-extrabold sm:pr-12">
                      {selectedItem?.name}
                    </h2>
                    <section
                      aria-labelledby="information-heading"
                      className="mt-2"
                    >
                      <p className="text-md font-medium">
                        Token Address:{' '}
                        <a
                          href="https://explorer.solana.com/address/GFjgvUPA252ARvCfe69AjijJv18EquTVRroGVV5LgTZr"
                          target="_blank"
                          title="GFjgvUPA252ARvCfe69AjijJv18EquTVRroGVV5LgTZr"
                          rel="noreferrer"
                          className="text-accent-200"
                        >
                          {selectedItem?.mint}
                        </a>
                      </p>
                    </section>
                    <section className="flex items-end w-full gap-4 font-bold text-xl mt-4">
                       <div className="text-left grow">
                      <h3 className="mb-6 text-xl font-bold md:text-2xl">Sell this Nft</h3>
                      <label className="block mb-1">Price in SOL</label>
                      <div className="prefix-input prefix-icon-sol">                       
                          <>
                            <input
                              autoFocus
                              value={sellAmount}
                              type="number"
                              onChange={(e: any) => {
                                setSellAmount(e.target.value)
                              }}
                              className="w-full h-10 pl-8 mb-4 text-black bg-transparent border-2 border-gray-500 rounded-md focus:outline-none"
                            />
                            <div className="flex flex-col gap-2 mb-4">
                              <div className="flex justify-between">
                                <span className="text-gray-400">{500 / 100}% creator royalty</span>
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
                      </div>
                      <div className="grid">
                        <button className="w-full h-12 text-sm text-white transition-colors duration-150 bg-black rounded-full lg:text-xl md:text-base focus:shadow-outline hover:bg-black"
                        onClick={()=>sellNftTransaction()}>List for sale</button>
                      </div>
                    </div>
                    </section>
                  </div>
                </div>
                <div>
                  <h4 className="text-xl text-primary font-medium mt-4 mb-2">
                    Attributes (2)
                  </h4>
                  <div className="w-full grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                    <div className="flex flex-col items-center text-center space-y-1 px-1 py-1.5 border shadow-sm text-md rounded text-primary bg-primary-300 focus:outline-none">
                      <span className="font-medium">Type</span>
                      <span>Purple</span>
                      <span>13.26%</span>
                    </div>
                    <div className="flex flex-col items-center text-center space-y-1 px-1 py-1.5 border shadow-sm text-md rounded text-primary bg-primary-300 focus:outline-none">
                      <span className="font-medium">Clothes</span>
                      <span>Brown Jacket</span>
                      <span>3.66%</span>
                    </div>
                    <div className="flex flex-col items-center text-center space-y-1 px-1 py-1.5 border shadow-sm text-md rounded text-primary bg-primary-300 focus:outline-none">
                      <span className="font-medium">Ears</span>
                      <span>None</span>
                      <span>78.08%</span>
                    </div>
                    <div className="flex flex-col items-center text-center space-y-1 px-1 py-1.5 border shadow-sm text-md rounded text-primary bg-primary-300 focus:outline-none">
                      <span className="font-medium">Mouth</span>
                      <span>None</span>
                      <span>73.64%</span>
                    </div>
                    <div className="flex flex-col items-center text-center space-y-1 px-1 py-1.5 border shadow-sm text-md rounded text-primary bg-primary-300 focus:outline-none">
                      <span className="font-medium">Eyes</span>
                      <span>None</span>
                      <span>71.52%</span>
                    </div>
                    <div className="flex flex-col items-center text-center space-y-1 px-1 py-1.5 border shadow-sm text-md rounded text-primary bg-primary-300 focus:outline-none">
                      <span className="font-medium">Hat</span>
                      <span>Sailor Cap</span>
                      <span>1.36%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xl text-primary font-medium mt-4 mb-2">
                    Offers (0)
                  </h4>
                </div>
              </div>
            </div>
          </Box>
        </Box>
      </Modal>
    </div>
  )
}
