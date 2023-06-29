import { existsSync } from "fs";
import { config } from "dotenv";
import { copyFile, mkdir, writeFile } from "fs/promises";
import { cli } from "./utils/cli";
import { yeildReserveOwnerOracleScript } from "../src/contracts/yeildReserveOwnerOracle";
import { mkTedyYeildReserveScript } from "../src/contracts/tedyYeildReserve";
import { PCurrencySymbol, PTokenName, PTxOutRef, PValidatorHash, pByteString, pData } from "@harmoniclabs/plu-ts";
import { mkStakingContract } from "../src/contracts/liquidityStakingContract";
import { execSync } from "child_process";
import { mkOneShotNFT } from "../src/policies/oneShotNFT";
import { fakeTEDYPolicy } from "../src/policies/fakeTEDYPolicy";
import { fromAscii } from "@harmoniclabs/uint8array-utils";

config();

async function setup()
{
    const promises: Promise<any>[] = [];
    if( !existsSync("./testnet") )
    {
        await mkdir("./testnet");
    }

    if( !existsSync("./testnet/address1.addr") )
    {
        execSync("node dist/app/setup.js");
    }

    const address = cli.utils.readAddress("./testnet/address1.addr");

    const [ utxo ] = await cli.query.utxo({ address });

    const oneShotNFT = mkOneShotNFT(
        PTxOutRef.fromData(
            pData( utxo.utxoRef.toData() )
        )
    );

    promises.push(
        writeFile("./testnet/mustSpendUtxo.txt", utxo.utxoRef.toString(), { encoding: "utf-8" }),
        cli.utils.writeScript( oneShotNFT, "./testnet/oneShotNFT.plutus.json" ),
    );

    const tedyYeildReserveScript = mkTedyYeildReserveScript(
        PValidatorHash.from( yeildReserveOwnerOracleScript.hash.toBuffer() ),
        PCurrencySymbol.from( oneShotNFT.hash.toBuffer() )
    );

    const stakingContract = mkStakingContract(
        PValidatorHash.from( tedyYeildReserveScript.hash.toBuffer() ),
        PCurrencySymbol.from( fakeTEDYPolicy.hash.toBuffer() ),
        PTokenName.from( fromAscii("fakeTEDY") )
    );
    
    promises.push(
        cli.utils.writeScript( yeildReserveOwnerOracleScript, "./testnet/yeildReserveOwnerOracle.plutus.json" ),
        cli.utils.writeScript( tedyYeildReserveScript, "./testnet/tedyYeildReserve.plutus.json" ),
        cli.utils.writeScript( stakingContract, "./testnet/stakingContract.plutus.json" ),
    );

    // wait for all files to be copied
    await Promise.all( promises );
}
setup();