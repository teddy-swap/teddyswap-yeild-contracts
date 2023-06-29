import { bs, fn, int, lam, pByteString, pInt, pdelay, pfn, phoist, pif, pintToBS, plam, plet, precursive, ptrace, punsafeConvertType } from "@harmoniclabs/plu-ts";
import { fromAscii } from "@harmoniclabs/uint8array-utils";

const pbif = pif( bs );

const loop = phoist(
    precursive(
        pfn([
            fn([ int ], bs ),
            int
        ],  bs)
        ( ( _self, n ) => {

            const self = punsafeConvertType( _self, lam( int, bs ) );

            return pbif.$( n.lt( 10 ) )
            .then( pintToBS.$( n ) )
            .else(
                self.$( n.div( 10 ) )
                .concat( 
                    pintToBS.$( 
                        n.mod( 10 ) 
                    ) 
                ) 
            )
        })
    )
);

export const pNumToBS =  phoist(
    plam( int, bs )
    ( n =>
        pbif.$( n.lt( 0 ) )
        .then(
            loop.$( pInt(0).sub( n ) )
            .prepend( fromAscii( "-" )[0] )
        )
        .else(
            pbif.$( n.lt( 10 ) )
            .then( pintToBS.$( n ) )
            .else( loop.$( n ) )
        )
    )   
);

export const ptraceNum = phoist(
    plam( int, int )
    (n => ptrace( int )
        .$( pNumToBS.$( n ).utf8Decoded )
        .$( n )
    )
)