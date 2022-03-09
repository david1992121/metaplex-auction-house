import { PublicKey, clusterApiUrl } from '@solana/web3.js';
export const CANDY_MACHINE = 'candy_machine';
export const AUCTION_HOUSE = 'auction_house';
export const TOKEN_ENTANGLER = 'token_entangler';
export const ESCROW = 'escrow';
export const A = 'A';
export const B = 'B';
export const FEE_PAYER = 'fee_payer';
export const TREASURY = 'treasury';
export const MAX_NAME_LENGTH = 32;
export const MAX_URI_LENGTH = 200;
export const MAX_SYMBOL_LENGTH = 10;
export const MAX_CREATOR_LEN = 32 + 1 + 1;
export const MAX_CREATOR_LIMIT = 5;
export const ARWEAVE_PAYMENT_WALLET = new PublicKey(
  '6FKvsq4ydWFci6nGq9ckbjYMtnmaqAoatz5c9XWjiDuS',
);
export const CANDY_MACHINE_PROGRAM_ID = new PublicKey(
  'cndyAnrLdpjq1Ssp1z8xxDsB8dxe7u4HL5Nxi2K5WXZ',
);

export const CANDY_MACHINE_PROGRAM_V2_ID = new PublicKey(
  'cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ',
  //'Ch3qpQYqr7AvLP6Eph9xxbtneAbzovzuEexAGh48URHS',
);
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);
export const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);
export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);
export const FAIR_LAUNCH_PROGRAM_ID = new PublicKey(
  'faircnAB9k59Y4TXmLabBULeuTLgV7TkGMGNkjnA15j',
);
export const AUCTION_HOUSE_PROGRAM_ID = new PublicKey(
  'hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk',
);
export const TOKEN_ENTANGLEMENT_PROGRAM_ID = new PublicKey(
  'qntmGodpGkrM42mN68VCZHXnKqDCT8rdY23wFcXCLPd',
);
export const WRAPPED_SOL_MINT = new PublicKey(
  'So11111111111111111111111111111111111111112',
);
export const GUMDROP_DISTRIBUTOR_ID = new PublicKey(
  'gdrpGjVffourzkdDRrQmySw4aTHr8a3xmQzzxSwFD1a',
);
export const GUMDROP_TEMPORAL_SIGNER = new PublicKey(
  'MSv9H2sMceAzccBganUXwGq3GXgqYAstmZAbFDZYbAV',
);

export const CONFIG_ARRAY_START =
  32 + // authority
  4 +
  6 + // uuid + u32 len
  4 +
  10 + // u32 len + symbol
  2 + // seller fee basis points
  1 +
  4 +
  5 * 34 + // optional + u32 len + actual vec
  8 + //max supply
  1 + //is mutable
  1 + // retain authority
  4; // max number of lines;

export const CONFIG_ARRAY_START_V2 =
  8 + // key
  32 + // authority
  32 + //wallet
  33 + // token mint
  4 +
  6 + // uuid
  8 + // price
  8 + // items available
  9 + // go live
  10 + // end settings
  4 +
  MAX_SYMBOL_LENGTH + // u32 len + symbol
  2 + // seller fee basis points
  4 +
  MAX_CREATOR_LIMIT * MAX_CREATOR_LEN + // optional + u32 len + actual vec
  8 + //max supply
  1 + // is mutable
  1 + // retain authority
  1 + // option for hidden setting
  4 +
  MAX_NAME_LENGTH + // name length,
  4 +
  MAX_URI_LENGTH + // uri length,
  32 + // hash
  4 + // max number of lines;
  8 + // items redeemed
  1 + // whitelist option
  1 + // whitelist mint mode
  1 + // allow presale
  9 + // discount price
  32 + // mint key for whitelist
  1 +
  32 +
  1; // gatekeeper

export const CONFIG_LINE_SIZE_V2 = 4 + 32 + 4 + 200;
export const CONFIG_LINE_SIZE = 4 + 32 + 4 + 200;

export const CACHE_PATH = './.cache';

export const DEFAULT_TIMEOUT = 15000;

export const EXTENSION_PNG = '.png';
export const EXTENSION_JPG = '.jpg';
export const EXTENSION_GIF = '.gif';
export const EXTENSION_JSON = '.json';

type Cluster = {
  name: string;
  url: string;
};
export const CLUSTERS: Cluster[] = [
  {
    name: 'mainnet-beta',
    url: 'https://api.metaplex.solana.com/',
  },
  {
    name: 'testnet',
    url: clusterApiUrl('testnet'),
  },
  {
    name: 'devnet',
    url: clusterApiUrl('devnet'),
  },
];
export const DEFAULT_CLUSTER = CLUSTERS[2];

export const AUCTION_HOUSE_ADDRESS = "9ydU1HEXAT2FRuqh3H1ZhgfvYKLnPZzjQxtSivRFFwwR";

// export const AH_KEYPAIR = [55, 1, 244, 93, 226, 76, 77, 102, 209, 220, 236, 30, 166, 116, 33, 153, 192, 130, 135, 41, 214, 231, 248, 22, 1, 25, 173, 194, 66, 138, 157, 249, 213, 144, 219, 243, 241, 7, 131, 229, 71, 113, 9, 0, 15, 61, 9, 233, 5, 148, 167, 8, 215, 238, 48, 162, 179, 209, 141, 55, 27, 150, 79, 190];

export const AUCTION_HOUSE_AUTHORITY = "DcqG8ySt4ERhN3Cr4oYgw5AJo4anUnAt7JjCMqeVDS4N";

export const AUCTION_HOUSE_FEE_PAYER = "2UyyDNCkmkFNWdxSpmhreLcGzMHxLKWnFb3ykAgjAuUy";