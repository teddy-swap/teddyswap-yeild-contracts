import { Hash28 } from "@harmoniclabs/plu-ts";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { fakeLpTokenPolicy } from "../../src/policies/fakeLpTokenPolicy";

export async function getFakeLpTokenHash()
{
    return ( existsSync("./testnet/fakeLpToken.hash") ) ?
    new Hash28( await readFile("./testnet/fakeLpToken.hash", { encoding: "utf-8"} ) ) :
    (() => {
        const stakeContractHash = fakeLpTokenPolicy.hash

        writeFile("./testnet/fakeLpToken.hash", stakeContractHash.toString(), { encoding: "utf-8"} );

        return stakeContractHash;
    })();    
}