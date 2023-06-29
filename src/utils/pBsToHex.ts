import { bs, fn, int, lam, list, pByteString, pInt, pfn, phoist, pif, plet, pnil, precursive, psliceBs, ptrace, punsafeConvertType } from "@harmoniclabs/plu-ts";
import { fromAscii } from "@harmoniclabs/uint8array-utils";

const pbif = pif( bs );

const pBs = pByteString;

const phexDigit = phoist(
    pfn([ int ], bs )
    ( n =>
        pbif.$( n.eq( 0 ) ).then( pBs( fromAscii("0") ) )
        .else( pbif.$( n.eq( 1 ) ).then( pBs( fromAscii("1") ) )
        .else( pbif.$( n.eq( 2 ) ).then( pBs( fromAscii("2") ) )
        .else( pbif.$( n.eq( 3 ) ).then( pBs( fromAscii("3") ) )
        .else( pbif.$( n.eq( 4 ) ).then( pBs( fromAscii("4") ) )
        .else( pbif.$( n.eq( 5 ) ).then( pBs( fromAscii("5") ) )
        .else( pbif.$( n.eq( 6 ) ).then( pBs( fromAscii("6") ) )
        .else( pbif.$( n.eq( 7 ) ).then( pBs( fromAscii("7") ) )
        .else( pbif.$( n.eq( 8 ) ).then( pBs( fromAscii("8") ) ) 
        .else( pbif.$( n.eq( 9 ) ).then( pBs( fromAscii("9") ) ) 
        .else( pbif.$( n.eq( 10 ) ).then( pBs( fromAscii("a") ) ) 
        .else( pbif.$( n.eq( 11 ) ).then( pBs( fromAscii("b") ) ) 
        .else( pbif.$( n.eq( 12 ) ).then( pBs( fromAscii("c") ) ) 
        .else( pbif.$( n.eq( 13 ) ).then( pBs( fromAscii("d") ) ) 
        .else( pbif.$( n.eq( 14 ) ).then( pBs( fromAscii("e") ) )
        .else( pBs( fromAscii("f") ) )
        ))))))))))))))
    )
);

const piif = pif( int );

const phexDigitNum = phoist(
    pfn([ int ], int )
    ( n =>
        piif.$( n.eq( 0 ) ).then( pInt( fromAscii("0")[0] ) )
        .else( piif.$( n.eq( 1  ) ).then( pInt( fromAscii("1")[0] ) )
        .else( piif.$( n.eq( 2  ) ).then( pInt( fromAscii("2")[0] ) )
        .else( piif.$( n.eq( 3  ) ).then( pInt( fromAscii("3")[0] ) )
        .else( piif.$( n.eq( 4  ) ).then( pInt( fromAscii("4")[0] ) )
        .else( piif.$( n.eq( 5  ) ).then( pInt( fromAscii("5")[0] ) )
        .else( piif.$( n.eq( 6  ) ).then( pInt( fromAscii("6")[0] ) )
        .else( piif.$( n.eq( 7  ) ).then( pInt( fromAscii("7")[0] ) )
        .else( piif.$( n.eq( 8  ) ).then( pInt( fromAscii("8")[0] ) ) 
        .else( piif.$( n.eq( 9  ) ).then( pInt( fromAscii("9")[0] ) ) 
        .else( piif.$( n.eq( 10 ) ).then( pInt( fromAscii("a")[0] ) ) 
        .else( piif.$( n.eq( 11 ) ).then( pInt( fromAscii("b")[0] ) ) 
        .else( piif.$( n.eq( 12 ) ).then( pInt( fromAscii("c")[0] ) ) 
        .else( piif.$( n.eq( 13 ) ).then( pInt( fromAscii("d")[0] ) ) 
        .else( piif.$( n.eq( 14 ) ).then( pInt( fromAscii("e")[0] ) )
        .else( pInt( fromAscii("f")[0] ) )
        ))))))))))))))
    )
);

const pbyteToHex = phoist(
    pfn([ int ], bs )
    ( n => phexDigit.$( n.div( 16 ) ).concat( phexDigit.$( n.mod(16) ) ) )
);

const pbyteToHexNums = phoist(
    pfn([ int ], list( int ) )
    ( n => pnil( int )
        .prepend( phexDigitNum.$( n.mod(16) ) )
        .prepend( phexDigitNum.$( n.div(16) ) )
    )
);

export const pBsToHex = phoist(
    pfn([ bs ], bs )
    ( b =>
        plet( psliceBs.$( 1 ) ).in( tailUpToBs => 
            precursive(
                pfn([
                    fn([ bs, int ], bs ),
                    bs,
                    int 
                ], bs )
                (( _self, b, len ) => {
        
                    const self = punsafeConvertType( _self, fn([ bs, int ], bs ) );

                    const len_1 = plet( len.sub( 1 ) );
                    const ints = pbyteToHexNums.$( b.at( pInt( 0 ) ) );
                    
                    return pbif.$( len.ltEq( 0 ) )
                    .then( pBs("") )
                    .else(
                        self.$( tailUpToBs.$( len ).$( b ) ).$( len_1 )
                        .prepend( ints.at( 1 ) )
                        .prepend( ints.at( 0 ) )
                    );
                })
            )
            .$( b )
            .$( b.length )
        )
    )
);

export const ptraceBs = phoist(
    pfn([ bs ], bs )
    ( b => ptrace( bs ).$( pBsToHex.$( b ).utf8Decoded ).$( b ) )
);