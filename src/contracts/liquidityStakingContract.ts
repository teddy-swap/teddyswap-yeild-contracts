import { PAddress, PCredential, PCurrencySymbol, PScriptContext, PTxInInfo, PTxOut, PTxOutRef, PValidatorHash, UtilityTermOf, bool, bs, fn, int, lam, list, pBool, pInt, pand, pdelay, peqBs, perror, pfn, phoist, pif, pisEmpty, plam, plet, pmatch, precursive, precursiveList, pstruct, punBData, punConstrData, punIData, punsafeConvertType } from "@harmoniclabs/plu-ts";
import { PReserveDatum } from "./tedyYeildReserve";

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
        upToTime: int
    },
    /**
     * performs Withdraw oand returns or adds lw Tokens form/to the value
     */
    AddOrRemoveLq: {},
});

const getCredentialHash = phoist(
    plam( PCredential.type, bs )
    ( creds =>
        punBData.$(
            punConstrData.$( creds as any ).snd.head 
        )
    )
)

const getPaymentHash = phoist(
    plam( PAddress.type, bs )
    ( addr => addr.extract("credential")
        .in( ({ credential }) => getCredentialHash.$( credential ) )
    )
);

/**
 * all the inputs from `1` to `n` MUST be from the reserve
 * and MUST be sorted by reward epoch
 * 
 * we need to validate tx inputs and outputs together
 * because each input from the reserve 
 * must go back to the reserve (unless drained)
 * 
 * so we write a custom loop instead of using something like `precursiveList`
**/
const mkValidateIO = (
    reserveValHashParamter: UtilityTermOf<typeof PValidatorHash>
) =>
plet(
    peqBs.$( reserveValHashParamter )
).in( isReserveValHash =>
    precursive(
        pfn([
            fn([
                list( PTxInInfo.type ),
                list( PTxOut.type )
            ],  bool),
            list( PTxInInfo.type ),
            list( PTxOut.type )
        ],  bool)
        (( self, inputs, outputs ) =>
    
            inputs .head.extract("resolved").in( ({ resolved: _input }) => 
            _input      .extract("address","value","datum").in( input => 
            outputs.head.extract("address","value","datum").in( output =>

            pmatch( input.datum )
            .onInlineDatum( _ => _.extract("datum").in( ({ datum }) => punsafeConvertType( datum, PReserveDatum.type ) ))
            ._( _ => perror( PReserveDatum.type ) )
            .extract("time","totStakedSupply","lqPolicy").in( inputDaum =>

            pmatch( output.datum )
            .onInlineDatum( _ => _.extract("datum").in( ({ datum }) => punsafeConvertType( datum, PReserveDatum.type ) ))
            ._( _ => perror( PReserveDatum.type ) )
            .extract("time","totStakedSupply","lqPolicy").in( outputDaum => {
                
                const inputFromReserve = isReserveValHash.$( getPaymentHash.$( input.address ) );
                const outputToReserve = isReserveValHash.$( getPaymentHash.$( output.address ) ); 

                const reserveDatumPreserved = input.datum.eq( output.datum );

                return reserveDatumPreserved
                .and(  inputFromReserve )
                .and(  outputToReserve  );

            })))))
        )
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
    validOwnInputNFTMarkerPolicy,
    datum, rdmr, ctx
) => {

    ctx.extract("txInfo","purpose").in( ({ txInfo, purpose }) =>
    txInfo.extract("inputs","outputs").in( tx =>
    datum.extract("ownerAddr","since").in( stakingInfos =>

        // tx input at position 0 MUST be the one being validated by the contract
        tx.inputs.head
        .extract("resolved","utxoRef").in(({ resolved: ownInput, utxoRef: ownInputRef }) =>

            ownInputRef.eq(
                pmatch( purpose )
                .onSpending( _ => _.extract("utxoRef").in( ({ utxoRef }) => utxoRef ))
                ._( _ => perror( PTxOutRef.type ) )
            )
            .and(

                pmatch( rdmr )
                .onWithdraw( _ => _.extract("upToTime").in( ({ upToTime }) => 
                ))
                .onAddOrRemoveLq( _ => 
                )
                
            )

        )

    )))

    return pBool( false )
})