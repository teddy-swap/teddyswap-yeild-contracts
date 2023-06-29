import { Address, DataI, Hash28, PaymentCredentials, Value, pDataB, pDataI } from "@harmoniclabs/plu-ts";
import { cli } from "./utils/cli";
import { existsSync } from "fs";
import { PReserveDatum } from "../src/contracts/tedyYeildReserve";
import { fakeTEDYPolicy } from "../src/policies/fakeTEDYPolicy";
import { getStakeContractHash } from "./common/getStakeContractHash";
import { getFakeLpTokenHash } from "./common/getFakeLpTokenHash";
import { fromAscii } from "@harmoniclabs/uint8array-utils";


async function setup()
{
    const address = cli.utils.readAddress("./testnet/address1.addr");
    const privateKey = cli.utils.readPrivateKey("./testnet/payment1.skey");

    const [ epoch_index, mint_amount ] = getArgs();

    const utxos = await cli.query.utxo({ address });

    const collaterals = [ utxos[0] ];

    const tedyYeildReserveAddress: Address =
    ( existsSync("./testnet/tedyYeildReserve.addr") ) ?
    cli.utils.readAddress("./testnet/tedyYeildReserve.addr") :
    (() => {
        const addr = new Address(
            "testnet",
            PaymentCredentials.script( 
                cli.utils.readScript("./testnet/tedyYeildReserve.plutus.json").hash
            )
        )

        cli.utils.writeAddress( addr, "./testnet/tedyYeildReserve.addr" );

        return addr;
    })();

    const stakeContractHash: Hash28 = await getStakeContractHash()

    const fakeLpTokenHash: Hash28 = await getFakeLpTokenHash();

    const mintedValue = new Value([
        Value.singleAssetEntry(
            fakeTEDYPolicy.hash,
            fromAscii( "fakeTEDY" ),
            mint_amount
        )
    ]);

    let tx = await cli.transaction.build({
        inputs: utxos.map( u => ({
            utxo: u
        })) as any,
        collaterals,
        collateralReturn: {
            address: address,
            value: Value.sub(
                collaterals[0].resolved.value,
                Value.lovelaces( 5_000_000 )
            )
        },
        mints: [
            {
                script: {
                    inline: fakeTEDYPolicy,
                    redeemer: new DataI( 0 ),
                    policyId: fakeTEDYPolicy.hash
                },
                value: mintedValue 
            }
        ],
        outputs: [
            {
                address: tedyYeildReserveAddress,
                datum: PReserveDatum.PReserveDatum({
                    forwardValidator: pDataB(
                        stakeContractHash.toBuffer()
                    ),
                    lpTokenCurrSym: pDataB( fakeLpTokenHash.toBuffer() ),
                    lpTokenName: pDataB( Buffer.from("lp","utf-8") ),
                    time: pDataI( epoch_index ),
                    totStakedSupply: pDataI( mint_amount * 10 )
                }),
                value: Value.add(
                    Value.lovelaces( 2_000_000 ),
                    mintedValue
                ),
            }
        ],
        changeAddress: address
    });

    tx = await cli.transaction.sign({ tx, privateKey });

    await cli.transaction.submit({ tx });
}
setup();

function getArgs(): [
    epoch_index: number,
    mint_amount: number
]
{
    const [ _, __, epoch, amt ] = process.argv;

    return [
        Math.abs( parseInt( epoch ) ),
        amt !== undefined && /^\d+$/.test( amt ) ? Math.abs( parseInt( amt ) ) : 1_000_000
    ];
}