import { config } from "dotenv";
import { readFile } from "fs/promises";

config();

let _startPOSIX: number | undefined = undefined;

export async function getNetworkStartPOSIX(): Promise<number>
{
    if( typeof _startPOSIX === "number" ) return _startPOSIX;

    const testnet = process.env.PRIVATE_TESTNET_PATH ?? ".";
    
    const res = await readFile(
        testnet + "/genesis/shelley/genesis.json",
        { encoding: "utf-8" }
    );
    
    _startPOSIX = Date.parse( JSON.parse(res).systemStart );
    return _startPOSIX;
}