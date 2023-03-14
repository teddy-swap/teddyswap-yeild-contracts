import { PCredential, POutputDatum, PScriptContext, PTxInInfo, PTxInfo, PTxOutRef, bool, bs, int, pBool, perror, pfn, plam, plet, pmatch, pstruct, punBData, punConstrData } from "@harmoniclabs/plu-ts";

const PYeildOwnerRedeemer = pstruct({
    ChangeOwner: {
        newOwner: PCredential.type,
        ownInputIdx: int
    }
})

/**
 * since ownership is updated with current owner consent
 * we do not require additional restrictions ( such as identifying nfts here )
 * 
 * however these might be required and checked by other contracts
 * 
 * (as in the case of the reserve)
 */
export const yeildReserveOwnerOracle = pfn([
    // owner
    // likely a multi-sig at the beginning;
    // upgraded to community owned smart contract in the future
    PCredential.type,
    PYeildOwnerRedeemer.type,
    PScriptContext.type
],  bool)
(( currentOwner, rdmr, _ctx ) => 

    _ctx.extract("txInfo","purpose").in(({ txInfo, purpose }) => {

    return pmatch( rdmr )
        .onChangeOwner( _ => _.extract("newOwner","ownInputIdx").in( ({ newOwner, ownInputIdx }) =>
            txInfo.extract("outputs","inputs").in( tx =>
                
            plet(
                plam( PTxInInfo.type, PCredential.type )
                ( input => 
                    input.extract("resolved").in( ({ resolved }) =>
                    resolved.extract("address").in( ({ address }) => 
                    address.extract("credential").in( ({ credential }) => credential
                ))))
            ).in( getInputPaymentCreds =>

                // require both old owner and new owner to sign
                // we want to support also scripts on top of public keys
                // so we check for inputs and not `signatories`
                // this requires to spend an utxo
                tx.inputs.some( input => 
                    getInputPaymentCreds.$( input ).eq( currentOwner )
                )
                .and(
                    tx.inputs.some( input => 
                        getInputPaymentCreds.$( input ).eq( newOwner )
                    )
                )
                // make sure info is updated
                .and(
                    
                    plet(
                        tx.inputs.at( ownInputIdx )
                    ).in( _ownInput => _ownInput.extract("resolved","utxoRef").in( ownInput =>

                        ownInput.utxoRef.eq(
                            pmatch( purpose )
                            .onSpending( _ => _.extract("utxoRef").in( ({ utxoRef }) => utxoRef ))
                            ._( _ => perror( PTxOutRef.type ) )
                        )
                        .and(

                            ownInput.resolved.extract("address").in(({ address: ownAddr }) => 
        
                                tx.outputs.some( _out => _out.extract("address","datum").in( out =>
                            
                                    out.datum.eq(
                                        POutputDatum.InlineDatum({
                                            datum: newOwner as any
                                        })
                                    )
                                    .and(
                                        out.address.eq( ownAddr )
                                    )
            
                                ))

                            )
                            
                        )
                    ))

                )

            ))
        ))
    })
)