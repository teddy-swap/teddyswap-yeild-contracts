import { PCredential, PCurrencySymbol, PScriptContext, PTokenName, PTxOut, PTxOutRef, PValidatorHash, PaymentCredentials, TxOut, addUtilityForType, bool, bs, data, int, pBool, perror, pfn, plam, plet, pmatch, pstruct, punBData, punConstrData, punsafeConvertType } from "@harmoniclabs/plu-ts";

export const PReserveDatum = pstruct({
    PReserveDatum: {
        // founds allocated to time
        time: int,
        // snapshot of total staked supply for that time
        totStakedSupply: int,
        /**
         * since multiple inputs can be included from this script
         * 
         * any loop (or recursive call) in this contract will be executed for each utxo
         * 
         * we need to loop over all inputs and outputs to calculate rewards eraned over time
         * 
         * so we forward the spending of all these outputs to a pre-chosen validator
         * (ideally the stake contract itself)
         * 
         * we still check that the transaction contains only a single input from the validator
         * (to prevent double satisfaciton)
         * 
         * and we also check that all other inputs are from this contract ( the reserve )
         * 
         * we can't really check the outputs as some migth be drained (aka. all rewards on that utxo are distributed)
         * so also outputs are forwarded to the validator specified
         * 
         * but **without** any additional logic on the reweard calculation that is expected to happen
         * in the forwarded validator
        **/
        forwardValidator: PValidatorHash.type,
        lpTokenCurrSym: PCurrencySymbol.type,
        lpTokenName: PTokenName.type
    }
});

const PReserveRedeemer = pstruct({
    Harvest: {
        ownInputIdx: int
    },
    BackToOwner: {
        ownerOracleRefInIdx: int
    }
});

/**
 * contract that holds the TEDY to be distributed
**/
const tedyYeildReserve = pfn([
    PValidatorHash.type,
    PCurrencySymbol.type,
    PReserveDatum.type,
    PReserveRedeemer.type,
    PScriptContext.type
],  bool)
((
    oracleValHash,      // yeildReserveOwnerOracle
    oracleCurrSymId,    // NFT currency symbol that must be present
    datum, rdmr, ctx
) => {

    return ctx.extract("txInfo","purpose").in(({ txInfo, purpose }) =>

        pmatch( rdmr )
        /**
         * reserve UTxO going back to main protocol treasurery
         */
        .onBackToOwner( _ => _.extract("ownerOracleRefInIdx").in(({ ownerOracleRefInIdx }) => 

            txInfo.extract("inputs","refInputs","outputs").in( tx =>

            tx.refInputs.at( ownerOracleRefInIdx )
            .extract("resolved").in( ({ resolved: _oracleRefIn }) => 
            _oracleRefIn.extract("address","value","datum").in( oracleRefIn => 

            plet(
                plam( PTxOut.type, PCredential.type )
                ( out =>
                    out.extract("address").in( ({ address: outAddress }) =>
                    outAddress.extract("credential").in( ({ credential }) =>
                        credential
                    ))
                )
            ).in( getOutCreds => 
                
            plet(
                /*
                only fails with the `NoDatum` `POutputDatum` constructor is used
                instead both `DatumHash` and `InlineDatum` do have a field
                
                however, even if it is a `DatumHash` is not a problem,
                since we are expecting some `PCredentials`, which are a structured data 
                and not a `DataB` as the field of `DatumHash`
                */
                PCredential.fromData(
                    punConstrData.$( oracleRefIn.datum as any )
                    .snd.head, // first field (either datum hash or the actual datum)
                )
            ).in( thisContractOwnerCredentials => {

                const isValidOracleRefIn = oracleRefIn.value.some( entry => entry.fst.eq( oracleCurrSymId ) ); 
                
                const oracleRefInComesFromContract = 
                    // is actually a reference input form the oracle
                    oracleRefIn.address.extract("credential")
                    .in(({ credential }) =>
                    
                        pmatch( credential )
                        .onPPubKeyCredential( _ => perror( bool ) )
                        .onPScriptCredential( _ => _.extract("valHash").in( ({ valHash }) =>
                            valHash.eq( oracleValHash ) 
                        ))

                    );

                const reserveOwnerSigned =
                    // check the inputs and not the signatories
                    // 
                    // this is done for two reasons:
                    //
                    // 1) if it is an actual user (a pkh), they would have to include one of
                    //    their utxo anyway because of the tx fees
                    // 2) to allow smart contracts to provide and stake liquidity
                    tx.inputs.some( _in => 
                        _in.extract("resolved").in( ({ resolved }) => 
                            getOutCreds.$( resolved )
                            .eq( thisContractOwnerCredentials )
                        )
                    );
                    

                const allOutsToOwner = 
                    // requires one input from the reserve owner
                    // (aka. the owner must be aware of the transfer)
                    tx.outputs.every( out => getOutCreds.$( out ).eq( thisContractOwnerCredentials ) );

                return isValidOracleRefIn
                .and(  oracleRefInComesFromContract )
                .and(  reserveOwnerSigned )
                .and(  allOutsToOwner );
                
            })))))
        ))
        .onHarvest( _ => 
            _.extract("ownInputIdx").in( ({ ownInputIdx }) =>

            txInfo.extract("inputs").in( tx =>
            
            tx.inputs.at( ownInputIdx )
            .extract("utxoRef","resolved")
            .in( ({ utxoRef: ownInputUtxoRef, resolved: ownInput }) =>

            plet(
                ownInput.extract("address").in(({ address }) =>
                address.extract("credential").in( ({ credential }) =>
                    punBData.$(
                        punConstrData.$( credential as any ).snd.head 
                    )
                ))
            ).in( ownHash =>
        
            plet(
                pmatch( purpose )
                .onSpending( _ => _.extract("utxoRef")
                    .in( ({ utxoRef: ownUtxoRef }) => ownUtxoRef )
                )
                ._( _ => perror( PTxOutRef.type ))
            ).in( ownUtxoRef => {

                const ownInputIsValid = ownInputUtxoRef.eq( ownUtxoRef );

                const fstInputIsForwarded = 
                tx.inputs.head.extract("resolved").in( ({ resolved }) => 
                resolved.extract("address").in(   ({ address })=> 
                address.extract("credential").in( ({ credential }) =>

                    pmatch( credential )
                    .onPScriptCredential( _ => _.extract("valHash").in( ({ valHash }) =>
                        datum.extract("forwardValidator").in( ({ forwardValidator }) => 
                            valHash.eq( forwardValidator )
                        )
                    ))
                    ._( _ => perror( bool ) )

                )));

                const allOtherInputsAreOwn =
                tx.inputs.tail.every( _in =>
                    _in.extract("resolved").in( ({ resolved }) => 
                    resolved.extract("address").in(({ address }) =>
                    address.extract("credential").in( ({ credential }) =>

                        pmatch( credential )
                        .onPScriptCredential( _ => _.extract("valHash").in( ({ valHash }) =>
                            valHash.eq( ownHash ) 
                        ))
                        .onPPubKeyCredential( _ => perror( bool ) )
                    
                    )))
                );
                
                return ownInputIsValid
                .and(  fstInputIsForwarded )
                .and(  allOtherInputsAreOwn );

            })))))
        )

    )
})