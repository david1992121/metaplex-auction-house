/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */
import { useEffect } from "react";

export default function AnNFT({ nft }: any) {
  useEffect(() => {
    // console.log(nft);
    // fetchNft(nft);
  }, []);

  return (
    <div className="card bordered max-w-xs compact rounded-md">
      <figure className="min-h-16 animation-pulse-color">
        <img
          className="bg-gray-800 object-cover"
          src={nft.uri}
          alt={nft.data.description || nft.data.name}
        />
      </figure>
      {/* <img src={nft.data.image} alt={nft.data.description || nft.data.name} /> */}
      <div className="flex justify-between mt-2 card-body">
        <p>{nft.data.name}</p>
        <p className="font-bold">{nft.data.symbol}</p>
      </div>
    </div>
  );
}
