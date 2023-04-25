import { config } from "dotenv";
import { readFile } from "fs/promises";

config();

let _sLen: number | undefined = undefined;

export async function getSlotLengthMs(): Promise<number>
{
    if( typeof _sLen === "number" ) return _sLen;

    const testnet = process.env.PRIVATE_TESTNET_PATH ?? ".";
    
    const res = await readFile(
        testnet + "/genesis/shelley/genesis.json",
        { encoding: "utf-8" }
    );
    
    _sLen = JSON.parse(res).slotLength * 1000;
    return _sLen;
}