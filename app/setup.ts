import { existsSync } from "fs";
import { config } from "dotenv";
import { copyFile, mkdir } from "fs/promises";

config();

async function setup()
{
    const privateTestnet = process.env.PRIVATE_TESTNET_PATH ?? ".";

    const nKeys = 3;

    const promises: Promise<any>[] = [];
    if( !existsSync("./testnet") )
    {
        await mkdir("./testnet");
    }
    
    for( let i = 1; i <= nKeys; i++ )
    {
        promises.push(
            copyFile(`${privateTestnet}/addresses/payment${i}.addr`, `./testnet/address${i}.addr`),
            copyFile(`${privateTestnet}/stake-delegator-keys/payment${i}.vkey`, `./testnet/payment${i}.vkey`),
            copyFile(`${privateTestnet}/stake-delegator-keys/payment${i}.skey`, `./testnet/payment${i}.skey`)
        );
    }

    // wait for all files to be copied
    await Promise.all( promises );
}
setup();