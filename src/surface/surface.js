/**
 * @file Surface
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */


import { Vector3, Box3, Geometry, BufferGeometry, Group, Color } from "../../lib/three.es6.js";

import { Debug, Log } from "../globals.js";
import { ColorMakerRegistry } from "../globals.js";
import { uniformArray, uniformArray3 } from "../math/array-utils.js";
import Selection from "../selection.js";


/**
 * Surface
 * @class
 * @param {String} name - surface name
 * @param {String} path - source path
 * @param {Object} data - surface data
 * @param {Float32Array} data.position - surface positions
 * @param {Int32Array} data.index - surface indices
 * @param {Float32Array} data.normal - surface normals
 * @param {Float32Array} data.color - surface colors
 * @param {Int32Array} data.atomindex - atom indices
 */
function Surface( name, path, data ){

    this.name = name;
    this.path = path;
    this.info = {};

    this.center = new Vector3();
    this.boundingBox = new Box3();

    if( data instanceof Geometry ||
        data instanceof BufferGeometry ||
        data instanceof Group
    ){

        // to be removed
        this.fromGeometry( data );

    }else if( data ){

        this.set(
            data.position,
            data.index,
            data.normal,
            data.color,
            data.atomindex,
            data.line
        );

    }

}

Surface.prototype = {

    constructor: Surface,
    type: "Surface",

    /**
     * set surface data
     * @param {Float32Array} position - surface positions
     * @param {Int32Array} index - surface indices
     * @param {Float32Array} normal - surface normals
     * @param {Float32Array} color - surface colors
     * @param {Int32Array} atomindex - atom indices
     * @return {undefined}
     */
    set: function( position, index, normal, color, atomindex, line ){

        this.position = position;
        this.index = index;
        this.normal = normal;
        this.color = color;
        this.atomindex = atomindex;

        this.size = position.length / 3;
        this.line = line

    },

    fromGeometry: function( geometry ){

        if( Debug ) Log.time( "GeometrySurface.fromGeometry" );

        var geo;

        if( geometry instanceof Geometry ){
            geometry.computeVertexNormals( true );
            geo = new BufferGeometry().fromGeometry( geometry );
        }else if( geometry instanceof BufferGeometry ){
            geo = geometry;
        }else{
            geo = geometry[ 0 ];
        }

        if( !geo.boundingBox ) geo.computeBoundingBox();

        this.center.copy( geo.boundingBox.center() );
        this.boundingBox.copy( geo.boundingBox );

        var position, color, index, normal;

        if( geo instanceof BufferGeometry ){

            var attr = geo.attributes;
            var an = attr.normal ? attr.normal.array : false;

            // assume there are no normals if the first is zero
            if( !an || ( an[ 0 ] === 0 && an[ 1 ] === 0 && an[ 2 ] === 0 ) ){
                geo.computeVertexNormals();
            }

            position = attr.position.array;
            index = attr.index ? attr.index.array : null;
            normal = attr.normal.array;

        }

        this.set( position, index, normal, color, undefined );

        if( Debug ) Log.timeEnd( "GeometrySurface.setGeometry" );

    },

    getPosition: function(){

        return this.position;

    },

    getColor: function( params ){

        var p = params || {};

        var n = this.size;
        var i, array, colorMaker;

        if( p.scheme === "volume" ){

            var v = new Vector3();
            var pos = this.position;
            colorMaker = ColorMakerRegistry.getScheme( p );

            array = new Float32Array( n * 3 );

            for( i = 0; i < n; ++i ){

                var i3 = i * 3;
                v.set( pos[ i3 ], pos[ i3 + 1 ], pos[ i3 + 2 ] );
                colorMaker.positionColorToArray( v, array, i3 );

            }

        }else if( this.atomindex ){

            p.surface = this;  // FIXME should this be p.surface???
            array = new Float32Array( n * 3 );
            colorMaker = ColorMakerRegistry.getScheme( p );
            var atomProxy = p.structure.getAtomProxy();
            var atomindex = this.atomindex;

            for( i = 0; i < n; ++i ){
                atomProxy.index = atomindex[ i ];
                colorMaker.atomColorToArray( atomProxy, array, i * 3 );
            }

        }else{

            var tc = new Color( p.value );
            array = uniformArray3( n, tc.r, tc.g, tc.b );

        }

        return array;

    },

    getPickingColor: function( params ){

        var p = Object.assign( params || {} );
        p.scheme = "picking";

        return this.getColor( p );

    },

    getNormal: function(){

        return this.normal;

    },

    getSize: function( size ){

        return uniformArray( this.size, size );

    },

    getIndex: function(){

        return this.index;

    },

    getFilteredIndex: function( sele, structure ){

        if( sele && this.atomindex ){

            var selection = new Selection( sele );
            var as = structure.getAtomSet( selection );
            var filteredIndex = [];

            var atomindex = this.atomindex;
            var index = this.index;
            var n = index.length;
            var j = 0;

            for( var i = 0; i < n; i+=3 ){

                var idx1 = index[ i     ];
                var idx2 = index[ i + 1 ];
                var idx3 = index[ i + 2 ];

                var ai1 = atomindex[ idx1 ];
                var ai2 = atomindex[ idx2 ];
                var ai3 = atomindex[ idx3 ];

                if( as.has( ai1 ) && as.has( ai2 ) && as.has( ai3 ) ){
                    filteredIndex[ j     ] = idx1;
                    filteredIndex[ j + 1 ] = idx2;
                    filteredIndex[ j + 2 ] = idx3;
                    j += 3;
                }

            }

            var TypedArray = this.position.length / 3 > 65535 ? Uint32Array : Uint16Array;
            return new TypedArray( filteredIndex );

        }else{

            return this.index;

        }

    },

    getAtomindex: function(){

        return this.atomindex;

    },

    getLinePositionData: function( sele, sview ) {
        var from, to;

        var n = this.index.length / 2;
        var n3 = 3 * n;

        from = new Float32Array( n3 );
        to = new Float32Array( n3 );

        var index = this.index;
        var position = this.position;
        for( var i = 0; i < n; i++ ){

            var _from =  3 * index[ 2*i ];
            var _to = 3 * index[ 2 * i + 1 ];

            from[ 3 * i ] = position[  _from ];
            from[ 3 * i + 1 ] = position[ _from + 1 ];
            from[ 3 * i + 2 ] = position[ _from + 2 ];

            to[ 3 * i ] = position[ _to ];
            to[ 3 * i + 1 ] = position[ _to + 1 ];
            to[ 3 * i + 2 ] = position[ _to + 2 ];

        }
        
        return {from: from, to: to};
    },

    getLineColorData: function( params ) {

        var tc = new Color(params.value);
        // TODO: Other color modes
        var array = uniformArray3( this.index.length / 2, tc.r, tc.g, tc.b );
        return { color: array,
                 color2: array }

    },

    dispose: function(){

        //

    }

};


export default Surface;
