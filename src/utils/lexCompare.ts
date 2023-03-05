
export const enum Ord {
    LT = -1,
    EQ = 0,
    GT = 1
}

export function lexCompare( a: Buffer, b: Buffer ): Ord
{
    const minLen = a.length < b.length ? a.length : b.length;

    for( let i = 0; i < minLen; i++ )
    {
        const _a = a.at(i);
        const _b = b.at(i);
        if( _a === undefined ) return Ord.LT;
        if( _b === undefined ) return Ord.GT;

        if( _a < _b ) return Ord.LT;
        if( _a > _b) return Ord.GT;
        // if( _a === _b ) continue;
    }

    return Ord.EQ;
}