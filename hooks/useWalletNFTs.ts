import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import * as anchor from "@project-serum/anchor";
import { existsOwnerSPLToken, getNFTsForOwner } from "../utils/candyMachine";
import {
  resolveToWalletAddress,
  getParsedNftAccountsByOwner
} from "@nfteyez/sol-rayz";
const rpcHost = process.env.NEXT_PUBLIC_SOLANA_RPC_HOST!;
const connection = new anchor.web3.Connection(rpcHost);

const useWalletNfts = () => {
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  // const [isSPLExists, setSPLExists] = useState(false);

  const [nfts, setNfts] = useState<Array<any>>([]);
  // useEffect(() => {
  //   (async () => {
  //     // if (
  //     //   !wallet ||
  //     //   !wallet.publicKey ||
  //     //   !wallet.signAllTransactions ||
  //     //   !wallet.signTransaction
  //     // ) {
  //     //   return;
  //     // }
  //     setIsLoading(true);
  //     // const address = "NftEyez.sol";
  //     setNfts([]);
  //     const publicAddress = await resolveToWalletAddress({
  //       text: "9cwUbHuSEGUL7Ne2pnUThFSs6Bo75mYDyNMhS86EBkJW"
  //     });
  //     console.log("wallet", wallet.publicKey?.toBase58());
  //     const fetchNft = async (nft: any) => {
  //       return await fetch(nft)
  //         .then((data: any) => data.json())
  //         .then((data: any) => {
  //           // console.log(data.image);
  //           return data.image;
  //         })
  //         .catch((error: any) => {
  //           console.error(error);
  //           return nft;
  //         });
  //     };

  //     const nftArray = await getParsedNftAccountsByOwner({
  //       publicAddress
  //     });
  //     console.log("nftArray", nftArray);
  //     if (nftArray) {
  //       nftArray.forEach(async (element) => {
  //         nfts.push({
  //           uri: await fetchNft(element.data.uri),
  //           ...element
  //         });
  //       });
  //     }
  //     console.log(nfts);
  //     setNfts(nfts as any);
  //   })();
  //   setIsLoading(false);
  // }, [wallet, nfts]);
  useEffect(() => {
    (async () => {
      if (
        !wallet ||
        !wallet.publicKey ||
        !wallet.signAllTransactions ||
        !wallet.signTransaction
      ) {
        return;
      }

      setIsLoading(true);

      const isExistSPLToken = await existsOwnerSPLToken(
        connection,
        wallet.publicKey
      );
      // console.log("isSPLExists " + isSPLExists);
      // setSPLExists(isExistSPLToken);

      const nftsForOwner = await getNFTsForOwner(connection, wallet.publicKey);
      console.log("nftsForOwner", nftsForOwner);
      console.log("wallet.publicKey", wallet.publicKey);
      setNfts(nftsForOwner as any);
      // console.log(nftsForOwner);
      setIsLoading(false);
    })();
  }, [wallet]);

  return [isLoading, nfts];
};

export default useWalletNfts;
