import { PAddress, PBool, PByteString, PCurrencySymbol, POutputDatum, PScriptContext, PTokenName, PTxInInfo, PTxOut, PTxOutRef, PValidatorHash, Term, TermFn, UtilityTermOf, bool, bs, fn, int, lam, list, pBSToData, pBool, pInt, pIntToData, pand, pdelay, peqBs, perror, pfn, phoist, pif, pisEmpty, plam, plet, pmatch, precursive, precursiveList, pstruct, punBData, punConstrData, punIData, punsafeConvertType } from "@harmoniclabs/plu-ts";
import { PReserveDatum } from "./tedyYeildReserve";
import { pgetLowerCurrentTime } from "../utils/pgetCurrentTime";
import { getPaymentHash } from "../utils/getPaymentHash";
import { pvalueOf } from "../utils/PValue/pvalueOf";

export const PLqStakingDatum = pstruct({
    PLqStakingDatum: {
        ownerAddr: PAddress.type,
        since: int,
        lpSym: PCurrencySymbol.type,
        lpName: PTokenName.type
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
    int, // minTime
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
    isReserveValHash: TermFn<[ PByteString ], PBool>,
    thisLpSym : UtilityTermOf<typeof PCurrencySymbol>,
    thisLpName: UtilityTermOf<typeof PTokenName>,
    rewardsTokenSym : UtilityTermOf<typeof PCurrencySymbol>,
    rewardsTokenName: UtilityTermOf<typeof PTokenName>,
) =>
    pfn([ int, int ], validateIOT )
    ( ( userStakedLp, upToTime ) => 
        precursive(
            pfn([
                validateIOT,
                int,
                list( PTxInInfo.type ),
                list( PTxOut.type )
            ],  bool)
            (( self, minTime, inputs, outputs ) =>
        
                inputs .head.extract("resolved").in( ({ resolved: _input }) => 
                _input      .extract("address","value","datum").in( input => 
                outputs.head.extract("address","value","datum").in( output =>
    
                pmatch( input.datum )
                .onInlineDatum( _ => _.extract("datum").in( ({ datum }) => punsafeConvertType( datum, PReserveDatum.type ) ))
                ._( _ => perror( PReserveDatum.type ) )
                .extract("time","totStakedSupply","forwardValidator","lpTokenCurrSym","lpTokenName").in( inDaum =>
    
                pmatch( output.datum )
                .onInlineDatum( _ => _.extract("datum").in( ({ datum }) => punsafeConvertType( datum, PReserveDatum.type ) ))
                ._( _ => perror( PReserveDatum.type ) )
                .extract("time","totStakedSupply","forwardValidator").in( outDaum => {
    
                    const meantForThisLpToken =
                        inDaum.lpTokenCurrSym.eq( thisLpSym )
                        .and( inDaum.lpTokenName.eq( thisLpName ) );

                    const inputFromReserve = isReserveValHash.$( getPaymentHash.$( input.address ) );
                    const outputToReserve = isReserveValHash.$( getPaymentHash.$( output.address ) ); 
    
                    const reserveDatumUnchanged = input.datum.eq( output.datum );
    
                    const correctTime =
                        inDaum.time.eq( minTime )
                        .and( outDaum.time.eq( minTime ) );
                        
                    const outputRewards = pvalueOf.$( output.value ).$( rewardsTokenSym ).$( rewardsTokenName );

                    const correctRewards = 
                        outputRewards
                        .eq(
                            plet(
                                pvalueOf.$( input.value ).$( rewardsTokenSym ).$( rewardsTokenName )
                            ).in( inputRewards =>
                                inputRewards.sub(
                                    inputRewards.mult( userStakedLp ).div( inDaum.totStakedSupply )
                                )
                            )
                        );

                    return meantForThisLpToken
                    .and(  inputFromReserve )
                    .and(  outputToReserve )
                    .and(  reserveDatumUnchanged )
                    .and(  correctTime )
                    .and(  correctRewards )
                    .and(
                        plet(
                            inputs.tail
                        ).in( nextInputs => 
                            pif( bool ).$( pisEmpty.$( nextInputs ) )
                            .then( inDaum.time.eq( upToTime ) )
                            .else(
                                self
                                .$( minTime.add( 1 ) )
                                .$( nextInputs )
                                .$( outputs.tail )
                            )
                        )
                    )
    
                })))))
            )
        )
    )

const liquidityStakingContract = (
    reserveValHash: UtilityTermOf<typeof PValidatorHash>
) => pfn([
    PCurrencySymbol.type,
    PCurrencySymbol.type,
    PTokenName.type,
    PLqStakingDatum.type,
    PLqStakingRedeemer.type,
    PScriptContext.type
], bool)
(( 
    validOwnInputNFTMarkerPolicy,
    TEDY_policy,
    TEDY_tokenName,
    datum, rdmr, ctx
) => {

    return ctx.extract("txInfo","purpose").in( ({ txInfo, purpose }) =>
    txInfo.extract("inputs","outputs","interval","mint").in( tx =>
    datum.extract("ownerAddr","since","lpName","lpSym").in( stakingInfos =>

    plet(
        peqBs.$( reserveValHash )
    ).in( isReserveValHash =>

    // tx input at position 0 MUST be the one being validated by the contract
    tx.inputs.head
    .extract("resolved","utxoRef").in(({ resolved: _ownInput, utxoRef: ownInputRef }) =>
    _ownInput.extract("address","value").in( ownInput => 
    
    rdmr.extract("upToTime").in( ({ upToTime }) =>

    plet(
        pgetLowerCurrentTime.$( tx.interval )
    ).in( currTime => 
    
    plet(
        pif( int ).$( currTime.ltEq( upToTime ) )
        .then( currTime )
        .else( upToTime )
    ).in( finalTime =>

    tx.outputs.head.extract("address", "value", "datum").in( fstOut =>

    plet(
        mkValidateIO(
            isReserveValHash,
            stakingInfos.lpSym,
            stakingInfos.lpName,
            TEDY_policy,
            TEDY_tokenName
        )
        // in both case these are the first three inputs
        // so we partially apply
        .$( 
            pvalueOf
            .$( ownInput.value )
            .$(stakingInfos.lpSym)
            .$(stakingInfos.lpName)
        )
        .$( finalTime )
        .$( stakingInfos.since )
        .$( tx.inputs.tail )
    )
    .in( validateReserveOuts => {

        // input ar position 0 is actually the one being vaidated
        const fstInputIsOwn = ownInputRef.eq(
            pmatch( purpose )
            .onSpending( _ => _.extract("utxoRef").in( ({ utxoRef }) => utxoRef ))
            ._( _ => perror( PTxOutRef.type ) )
        );

        // input is certified (aka, the datum is trusted)
        // if the value contains a predefined NFT
        const ownInputIsCertified = ownInput.value.some( entry => entry.fst.eq( validOwnInputNFTMarkerPolicy ) );

        const fstOutGoingBackHere = fstOut.address.eq( ownInput.address ) 

        // if lp still staked
        const nftStaysHere = 
            // nft going back here
            fstOut.value.some( entry =>  entry.fst.eq( validOwnInputNFTMarkerPolicy ) );

        const onlySinceFieldUpdated = fstOut.datum.eq(
            POutputDatum.InlineDatum({
                datum: PLqStakingDatum.PLqStakingDatum({
                    ownerAddr: stakingInfos.ownerAddr as any, // same owner address
                    since:  pIntToData.$( finalTime ), // updated with this withraw timestamp
                    lpSym:  pBSToData.$( stakingInfos.lpSym  ) as any, // same lpSym  
                    lpName: pBSToData.$( stakingInfos.lpName ) as any  // same lpName 
                }) as any
            })
        );
        
        // to use if the first is going back here
        const sndOutToOwner = tx.outputs.tail.head.extract("address").in( sndOut =>
            // second output going to user
            sndOut.address.eq( stakingInfos.ownerAddr )
        );

        // to use if the lp tokens are 100% withdrawn
        const fstOutToOwner = fstOut.address.eq( stakingInfos.ownerAddr );

        const burnedCertifyngNFT = tx.mint.some( entry => 
            entry.fst.eq( validOwnInputNFTMarkerPolicy )
            .and(
                entry.snd.every( asset =>
                    asset.snd.lt( 0 ) // burning 
                )
            )
        );

        const validIO = // if fistOut going back to this contract
            pif( bool ).$( fstOutGoingBackHere )
            .then(
                sndOutToOwner
                .and( nftStaysHere )
                .and( onlySinceFieldUpdated )
                .and(
                    validateReserveOuts
                    .$( tx.outputs.tail.tail )
                )
            )
            .else(
                // if not back here then the first output is the one going to the user
                fstOutToOwner
                // since nothing is going back here we must be sure we are burning the NFT
                .and( burnedCertifyngNFT )
                // checks for datums
                .and(
                    validateReserveOuts
                    .$( tx.outputs.tail )
                )
            )

        return fstInputIsOwn
        .and(  ownInputIsCertified )
        .and(  validIO );

    })))))))))))
})