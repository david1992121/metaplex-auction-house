import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { Metadata } from '@metaplex-foundation/mpl-token-metadata'
import { useWallet } from '@solana/wallet-adapter-react'
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
import { AUCTION_HOUSE_ADDRESS, AH_KEYPAIR } from '../helpers/constants'
import { sell } from '../auction-house'
import { Sell } from '../helpers/types'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionInstruction,
  Transaction,
} from '@solana/web3.js'
import { AuctionHouseProgram } from '@metaplex-foundation/mpl-auction-house'
import { ISingleNFT } from '../types/nft_details.d'
import { useNFTDetails, useNFTProfile, useConnectionConfig } from '../context'
import {
  tradeStatePDA,
  freeSellerTradeStatePDA,
  getSellInstructionAccounts,
  callCancelInstruction,
  tokenSize,
} from '../helpers/actions'
import {
  AUCTION_HOUSE_PREFIX,
  AUCTION_HOUSE,
  AUCTION_HOUSE_PROGRAM_ID,
  TREASURY_MINT,
  toPublicKey,
  createSellInstruction,
  SellInstructionArgs,
  SellInstructionAccounts,
  getMetadata,
  StringPublicKey,
  bnTo8,
} from '../web3'

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
  bgcolor: '#ffffff88',
  boxShadow: 24,
  p: 4,
}

const Img = styled('img')({
  margin: 'auto',
  display: 'block',
  maxWidth: '100%',
  maxHeight: '100%',
})

export interface NftProps {
  connection: anchor.web3.Connection
}

export const Nft = (props: NftProps) => {
  const router = useRouter()

  const wallet = useWallet()

  const { connected, publicKey, sendTransaction } = wallet

  const [list, setList] = useState([])

  const [open, setOpen] = useState(false)

  const [selectedItem, setSelectedItem] = useState<any>({})

  const [buyPrice, setBuyPrice] = useState(0)

  const {
    general,
    fetchGeneral,
    nftMetadata,
    updateUserInput,
    sellNFT,
  } = useNFTDetails()
  const { sessionUser } = useNFTProfile()
  const { connection, network } = useConnectionConfig()
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
  const sellMyNft = async (mint: string) => {
    const sell_param: Sell = {
      keypair: anchorWallet,
      env: 'devnet',
      auctionHouse: AUCTION_HOUSE_ADDRESS,
      auctionHouseKeypair: Keypair.fromSecretKey(Uint8Array.from(AH_KEYPAIR)),
      buyPrice: buyPrice,
      mint: mint,
      tokenSize: 1,
      auctionHouseSigns: true,
    }
    if (mint || buyPrice !== 0 || buyPrice !== undefined) {
      console.log('sell_param', sell_param)
      sell(sell_param)
    } else {
      alert('you are trying wrong action!')
    }
  }
  const derivePDAsForInstruction = async () => {
    const buyerPriceInLamports =
      parseFloat(userInput['minimumBid'] || 0) * LAMPORTS_PER_SOL
    const buyerPrice: anchor.BN = new anchor.BN(buyerPriceInLamports)

    const metaDataAccount: StringPublicKey = await getMetadata(
      general.mint_address,
    )
    const tradeState: [PublicKey, number] = (await tradeStatePDA(
      publicKey as any,
      general,
      bnTo8(buyerPrice),
    )) as [PublicKey, number]
    const freeTradeState: [PublicKey, number] = (await freeSellerTradeStatePDA(
      publicKey as any,
      general,
    )) as [PublicKey, number]
    const programAsSignerPDA: [
      PublicKey,
      number,
    ] = await PublicKey.findProgramAddress(
      [Buffer.from(AUCTION_HOUSE_PREFIX), Buffer.from('signer')],
      toPublicKey(AUCTION_HOUSE_PROGRAM_ID),
    )

    if (
      !tradeState ||
      !freeTradeState ||
      !programAsSignerPDA ||
      !metaDataAccount
    ) {
      throw Error(`Could not derive values for sell instructions`)
    }

    return {
      metaDataAccount,
      tradeState,
      freeTradeState,
      programAsSignerPDA,
      buyerPrice,
    }
  }
  const callSellInstruction = async (e: any) => {
    const {
      metaDataAccount,
      tradeState,
      freeTradeState,
      programAsSignerPDA,
      buyerPrice,
    } = await derivePDAsForInstruction()

    console.log(
      metaDataAccount,
      tradeState,
      freeTradeState,
      programAsSignerPDA,
      buyerPrice.toString(),
    )

    const sellInstructionArgs: SellInstructionArgs = {
      tradeStateBump: tradeState[1],
      freeTradeStateBump: freeTradeState[1],
      programAsSignerBump: programAsSignerPDA[1],
      buyerPrice: buyerPrice,
      tokenSize: tokenSize,
    }

    const sellInstructionAccounts: SellInstructionAccounts = await getSellInstructionAccounts(
      publicKey as any,
      general,
      metaDataAccount,
      tradeState[0],
      freeTradeState[0],
      programAsSignerPDA[0],
    )

    const sellIX: TransactionInstruction = await AuctionHouseProgram.instructions.createSellInstruction(
      sellInstructionAccounts,
      sellInstructionArgs,
    )
    console.log(sellIX)

    const transaction = new Transaction().add(sellIX)
    const signature = await sendTransaction(transaction, connection)
    console.log(signature)
    const confirm = await connection.confirmTransaction(signature, 'processed')
    console.log(confirm)

    if (confirm.value.err === null) {
      postTransationToAPI(signature, buyerPrice, tokenSize).then((res: any) => {
        console.log(res)
        if (!res) {
          callCancelInstruction(
            wallet,
            connection,
            general,
            tradeState,
            buyerPrice,
          )
        }

        setTimeout(() => {
          //   alert(successfulListingMsg(signature, nftMetadata, userInput['minimumBid']))
          //   history.push('/NFTs/profile')
          alert('this is successful tx')
        }, 2000)
      })
    }
  }

  const postTransationToAPI = async (
    txSig: any,
    buyerPrice: anchor.BN,
    tokenSize: anchor.BN,
  ) => {
    const sellObject = {
      ask_id: null,
      clock: Date.now().toString(),
      tx_sig: txSig,
      wallet_key: publicKey?.toBase58(),
      auction_house_key: AUCTION_HOUSE,
      token_account_key: general.token_account,
      auction_house_treasury_mint_key: TREASURY_MINT,
      token_account_mint_key: general.mint_address,
      buyer_price: buyerPrice.toString(),
      token_size: tokenSize.toString(),
      non_fungible_id: general.non_fungible_id,
      collection_id: general.collection_id,
      user_id: sessionUser.user_id,
    }

    try {
      const res = await sellNFT(sellObject)
      console.dir(res)
      if (res.isAxiosError) {
        // notify({
        //   type: 'error',
        //   message: (
        //     <TransactionErrorMsg
        //       title={`NFT Listing error!`}
        //       itemName={nftMetadata.name}
        //       supportText={`Please try again, if the error persists please contact support.`}
        //     />
        //   )
        // })
        alert(nftMetadata.name + ': this has error')
        return false
      } else {
        return true
      }
    } catch (error) {
      console.error(error)
      return false
    }
  }
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
                  onClick={() =>
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
            {/* <Grid container spacing={2}>
                        <Grid item xs={4}>
                            <Img alt="complex" src={selectedItem?.image} />
                            <h2> 
                                <Typography variant="subtitle1" component="div">
                                {selectedItem.name}
                                </Typography>
                            </h2>
                        </Grid>
                        <Grid item xs={8} sm container direction="column">
                            <Grid
                                container
                                direction="row"
                                justifyContent="space-evenly"
                                alignItems="center"
                            >
                            {selectedItem?.attributes &&
                            Object.entries(selectedItem?.attributes)?.map((item_props:any, i:any) => {
                                <Grid item xs={4} className="border-5 rounded border-warning p-4" key={i}>
                                    <Typography gutterBottom variant="subtitle1" component="div">
                                        {item_props[0]} : {item_props[1]}
                                    </Typography>
                                </Grid>
                            })}
                            </Grid>
                            <Grid
                                container
                                direction="row"
                                justifyContent="space-evenly"
                                alignItems="center" 
                            >
                            {selectedItem?.creator?.map((creator:any, i:any) => {
                                <Grid item xs={4} className="border-5 rounded border-warning p-4" key={i}>
                                    <Typography gutterBottom variant="subtitle1" component="div">
                                        {creator.address} : {creator.share} : {creator.verified?"true":"false"}
                                    </Typography>
                                </Grid>
                            })}
                            </Grid>
                            <Grid item>
                                <Typography variant="subtitle1" component="div">
                                {selectedItem.symbol}
                                </Typography>
                            </Grid>
                            <Grid item>
                                <Button variant="contained" onClick={() => {
                                    console.log("sell");
                                }}>
                                    Sell
                                </Button>
                            </Grid>
                        </Grid>
                    </Grid> */}
            <div className="w-full relative flex flex-col bg-primary-200 overflow-hidden shadow-2xl">
              <div className="w-full flex justify-between p-2">
                <Button
                  className="text-primary hover:text-secondary text-black"
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
                </Button>
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
                      <div className="w-full space-y-2">
                        <TextField
                          id="outlined-number"
                          label="Sell price"
                          type="number"
                          InputLabelProps={{
                            shrink: true,
                          }}
                          className="w-full"
                          onChange={(e: any) => setBuyPrice(e.target.value)}
                        />
                      </div>
                      <div className="w-full space-y-2">
                        <Button
                          variant="contained"
                          className="inline-flex w-full items-center justify-center text-white text-center px-2.5 py-2.5 border border-transparent text-lg font-bold rounded shadow-sm bg-secondary hover:bg-secondary-200 focus:outline-none "
                          onClick={() => sellMyNft(selectedItem.mint)}
                        >
                          Sell
                        </Button>
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
