import { PAddress, PBool, PByteString, PCredential, PCurrencySymbol, POutputDatum, PScriptContext, PTxInInfo, PTxOut, PTxOutRef, PValidatorHash, TermFn, UtilityTermOf, bool, bs, fn, int, lam, list, pBool, pInt, pIntToData, pand, pdelay, peqBs, perror, pfn, phoist, pif, pisEmpty, plam, plet, pmatch, precursive, precursiveList, pstruct, punBData, punConstrData, punIData, punsafeConvertType } from "@harmoniclabs/plu-ts";
import { PReserveDatum } from "./tedyYeildReserve";
import { pgetLowerCurrentTime } from "../utils/pgetCurrentTime";
import { getPaymentHash } from "../utils/getPaymentHash";
import { finished } from "stream";

export const PLqStakingDatum = pstruct({
    PLqStakingDatum: {
        ownerAddr: PAddress.type,
        since: int,
    }
});

const PLqStakingRedeemer = pstruct({
    /**
     * also allows for lq deposits / withdraws
    **/
    Harvest: {
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
    }
});

const validateIOT = fn([
    list( PTxInInfo.type ),
    list( PTxOut.type )
],  bool);

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
    isReserveValHash: TermFn<[ PByteString ], PBool>
) =>
    plam( int , validateIOT )
    ( upToTime => 
        precursive(
            pfn([
                validateIOT,
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
    
                    not finished

                    return reserveDatumPreserved
                    .and(  inputFromReserve )
                    .and(  outputToReserve  );
    
                })))))
            )
        )
    )

const liquidityStakingContract = (
    reserveValHash: UtilityTermOf<typeof PValidatorHash>
) => pfn([
    PCurrencySymbol.type,
    PLqStakingDatum.type,
    PLqStakingRedeemer.type,
    PScriptContext.type
], bool)
(( 
    validOwnInputNFTMarkerPolicy,
    datum, rdmr, ctx
) => {

    ctx.extract("txInfo","purpose").in( ({ txInfo, purpose }) =>
    txInfo.extract("inputs","outputs","interval").in( tx =>
    datum.extract("ownerAddr","since").in( stakingInfos =>

    plet(
        peqBs.$( reserveValHash )
    ).in( isReserveValHash =>

        // tx input at position 0 MUST be the one being validated by the contract
        tx.inputs.head
        .extract("resolved","utxoRef").in(({ resolved: _ownInput, utxoRef: ownInputRef }) =>
        _ownInput.extract("address","value").in( ownInput =>

            // input ar position 0 is actually the one being vaidated
            ownInputRef.eq(
                pmatch( purpose )
                .onSpending( _ => _.extract("utxoRef").in( ({ utxoRef }) => utxoRef ))
                ._( _ => perror( PTxOutRef.type ) )
            )
            // input is certified (aka, the datum is trusted)
            .and(
                ownInput.value.some( entry => entry.fst.eq( validOwnInputNFTMarkerPolicy ) )
            )
            .and(

                rdmr.extract("upToTime").in( ({ upToTime }) =>

                plet(
                    pgetLowerCurrentTime.$( tx.interval )
                ).in( currTime => 
                
                plet(
                    pif( int ).$( currTime.ltEq( upToTime ) )
                    .then( currTime )
                    .else( upToTime )
                ).in( finalTime => {

                    tx.outputs.head.extract("address", "value", "datum").in( fstOut =>

                    plet(
                        mkValidateIO( isReserveValHash )
                        // in both case these are the first two inputs
                        // so we partially apply
                        .$( stakingInfos.since )
                        .$( tx.inputs.tail )
                    )
                    .in( validateReserveOuts => 

                        // if fistOut going back to this contract
                        pif( bool ).$( fstOut.address.eq( ownInput.address ) )
                        .then(
                            tx.outputs.tail.head.extract("address", "value", "datum").in( sndOut =>
                                
                                // nft going back here
                                fstOut.value.some( entry =>  entry.fst.eq( validOwnInputNFTMarkerPolicy ) )
                                .and(
                                    fstOut.datum.eq(
                                        POutputDatum.InlineDatum({
                                            datum: PLqStakingDatum.PLqStakingDatum({
                                                ownerAddr: stakingInfos.ownerAddr as any, // same owner address
                                                since: pIntToData.$( finalTime ) // updated with this withraw timestamp
                                            }) as any
                                        })
                                    )
                                )
                                .and(
                                    validateReserveOuts
                                    .$( tx.outputs.tail.tail )
                                )
                            )
                        )
                        .else(

                            // if not back here then the first output is the one going to the user
                            fstOut.address.eq( stakingInfos.ownerAddr )
                            // since nothing is going back here we must be sure we are burning the NFT
                            .and(
                                validateReserveOuts
                                .$( tx.outputs.tail )
                            )
                        )
                    
                    ))

                    return pBool( false );
                })))

            )

        ))

    ))))

    return pBool( false )
})