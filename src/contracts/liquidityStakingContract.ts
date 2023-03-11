import { PAddress, PCurrencySymbol, PScriptContext, PTxInInfo, PTxOutRef, PValidatorHash, bool, int, lam, list, pBool, pInt, pand, pdelay, perror, pfn, pif, pisEmpty, plet, pmatch, precursiveList, pstruct, punConstrData, punIData } from "@harmoniclabs/plu-ts";

export const PLqStakingDatum = pstruct({
    PLqStakingDatum: {
        ownerAddr: PAddress.type,
        since: int,
    }
});

const PLqStakingRedeemer = pstruct({
    Withdraw: {
        /**
         * since we perform auto-harvest calculation at withdraw
         * is possible that if the staked utxo has been here for long time
         * calculation will exceed cpu limits
         * 
         * as a workaround we introduce the possibility to withdraw up to a certain point in time
         * so that it can still be processed with two or more transactions
         * in the case explained above
        **/
        upToTime: int,
        /**
         * @type {0 | 1}
         * if `1` ( or greather ) rewards will stay in the contract (useful for the case of multi tx withdraw)
         * if `0` ( or smaller  ) rewards are sent to owner and the marker NFT is burned
         */
        keepInContract: int
    },
    /**
     * performs Withdraw of rewards to the contract and updates
     */
    AddLq: {

    }
});

/**
 * all the inputs from 1 to n MUST be from the reserve
 * and MUST be sorted by reward epoch
 * 
 * we need to validate tx inputs and outputs together
 * so we write a custom loop
**/
const validateIO = precursive(
    pfn([

    ],  bool)
    (() => 
    )
)

const liquidityStakingContract = pfn([
    PValidatorHash.type,
    PCurrencySymbol.type,
    PLqStakingDatum.type,
    PLqStakingRedeemer.type,
    PScriptContext.type
], bool)
((  reserveValHash, 
    validInputMarkerPolicy,
    datum, rdmr, ctx
) => {

    ctx.extract("txInfo","purpose").in( ({ txInfo, purpose }) =>
    txInfo.extract("inputs","outputs").in( tx =>

        // tx input at position 0 MUST be the one being validated by the contract
        tx.inputs.head
        .extract("resolved","utxoRef").in(({ resolved: ownInput, utxoRef: ownInputRef }) =>

            ownInputRef.eq(
                pmatch( purpose )
                .onSpending( _ => _.extract("utxoRef").in( ({ utxoRef }) => utxoRef ))
                ._( _ => perror( PTxOutRef.type ) )
            )
            .and(

                ownInput.extract("value").in( ({ value: ownValue }) =>
                    ownValue.some
                )
            )
        )

    ))

    return pBool( false )
})