#version 300 es
precision highp float;
precision highp int;
#define USE_COLOR
uniform mat4 viewMatrix;uniform vec3 cameraPosition;uniform bool isOrthographic;
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
vec4 linearToOutputTexel( vec4 value ){ return value; }
uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
in vec3 vNormal;
#endif
#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
in vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated
in vec3 coralWeatherP;
float cwHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float cwNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(cwHash(i),cwHash(i+vec3(1,0,0)),f.x),mix(cwHash(i+vec3(0,1,0)),cwHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(cwHash(i+vec3(0,0,1)),cwHash(i+vec3(1,0,1)),f.x),mix(cwHash(i+vec3(0,1,1)),cwHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
uniform vec3 gregInk;
uniform vec3 gregFace;
uniform vec3 gregShade;
uniform float gregWaterline;
in vec3 gregLocal;
in vec3 gregLocalNormal;
in float gregViewDepth;
#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif
#if defined( USE_COLOR_ALPHA )
in vec4 vColor;
#elif defined( USE_COLOR )
in vec3 vColor;
#endif
#if defined( USE_UV ) || defined( USE_ANISOTROPY )
in vec2 vUv;
#endif
#ifdef USE_MAP
in vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
in vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
in vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
in vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
in vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
in vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
in vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
in vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
in vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
in vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
in vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
in vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
in vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
in vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
in vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
in vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
in vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
in vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
in vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
in vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
in vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
in vec2 vThicknessMapUv;
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif
#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif
#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif
#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif
#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif
#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif
#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
in vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
in vec3 vReflect;
	#endif
#endif
#ifdef USE_FOG
	uniform vec3 fogColor;
in float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif
#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif
#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
in float vFragDepth;
in float vIsPerspective;
#endif
#if NUM_CLIPPING_PLANES > 0
in vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif
	#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif
	#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif
	#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif
float gregDistanceInk = 1.0 - smoothstep(12.0, 34.0, gregViewDepth);

    // Water height is expressed in this mesh's coordinates, not inner-world Y.
    diffuseColor.rgb = mix(gregShade, gregFace, step(gregWaterline, gregLocal.y));
    float theta = atan(gregLocal.z, gregLocal.x);
    float layer = (gregLocal.y - gregWaterline) / 5.8 + sin(theta * 5.0) * 0.18 + sin(theta * 11.0) * 0.035;
    float stonePlane = step(0.68, fract(layer));
    diffuseColor.rgb = mix(diffuseColor.rgb, gregShade, stonePlane * 0.14);
    float phaseWidth = max(fwidth(layer), 0.0001);
    float bandInk = 1.0 - smoothstep(phaseWidth * 0.35, phaseWidth * 1.15, abs(fract(layer + 0.5) - 0.5));
    float detailLOD = 1.0 - smoothstep(0.12, 0.28, phaseWidth);
    float interrupted = step(-0.1, sin(theta * 3.0 + floor(layer) * 1.7));
    float strataLOD = 0.0;
    float crackPhase = theta * 3.5 + sin(gregLocal.y * 0.43 + theta) * 0.10;
    float crackWidth = max(fwidth(crackPhase), 0.0001);
    float crack = 1.0 - smoothstep(crackWidth * 0.30, crackWidth, abs(fract(crackPhase + 0.5) - 0.5));
    float crackBreak = smoothstep(0.45, 0.65, sin(gregLocal.y * 0.39 + floor(crackPhase + 0.5) * 1.9));
    float crackLOD = (1.0 - smoothstep(0.08, 0.20, crackWidth)) * gregDistanceInk;
    float rockInk = max(bandInk * interrupted * detailLOD * strataLOD * 0.30, crack * crackBreak * crackLOD * 0.32);
    diffuseColor.rgb = mix(diffuseColor.rgb, gregInk, rockInk);
  
	#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif
	#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif
	#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif
	float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif
	
   {
   vec3 cwUnweathered=outgoingLight;
   float cwAngle=atan(coralWeatherP.z,coralWeatherP.x);
   float cwY=coralWeatherP.y;
   // Overlapping 3D mineral fields break up broad planar slabs without a
   // camera-space texture or repeated angular bands.
   float cwBroad=cwNoise(coralWeatherP*vec3(.105,.14,.105));
   float cwMottle=cwBroad*.62+cwNoise(coralWeatherP*vec3(.31,.42,.31))*.28+cwNoise(coralWeatherP*vec3(.78,.94,.78))*.10;
   float cwPatina=smoothstep(.28,.76,cwMottle);
   // Broad catchments descend from rim joints; horizontal drift avoids stripes.
   float cwCatchment=sin(cwAngle*7.+sin(cwAngle*3.)*.65+cwY*.035);
   float cwPatches=sin(cwAngle*17.+cwY*.23+sin(cwY*.43)*.38)*.58
                +sin(cwAngle*29.-cwY*.39)*.28+sin(cwAngle*47.+cwY*.61)*.14;
   float cwMoss=smoothstep(-.12,.50,cwCatchment)*smoothstep(-.25,.30,cwPatches)
              *smoothstep(.36,.64,cwMottle)*smoothstep(26.,37.,cwY)*.88;
   float cwWet=(1.-smoothstep(25.5,29.7+.55*sin(cwAngle*9.),cwY))*.30;
   float cwMineral=smoothstep(.65,.90,sin(cwAngle*13.+cwY*.11))
                 *smoothstep(.25,.55,cwPatches)*.38;
   vec3 cwStone=vec3(0.22322796,0.27889426,0.31854678);
   vec3 cwCool=vec3(0.14126329,0.19120168,0.22696587),cwWarm=vec3(0.32777810,0.30498731,0.25818285);
   cwStone=mix(cwCool,cwWarm,cwPatina);
   float cwBaseAmount=.43;
   outgoingLight=mix(outgoingLight,cwStone,cwBaseAmount);
   outgoingLight*=.88+.20*cwMottle;
   outgoingLight=mix(outgoingLight,vec3(0.13013648,0.20155625,0.23455058),cwWet);
   outgoingLight=mix(outgoingLight,vec3(0.47932018,0.40197778,0.31854678),cwMineral);
   outgoingLight=mix(outgoingLight,vec3(0.17144110,0.34191442,0.23455058),cwMoss);
   // A few broken, antialiased erosion fissures; quiet stone stays quiet.
   float cwCrackPhase=cwAngle*23.+sin(cwY*.37+cwAngle*2.)*.19;
   float cwEdge=abs(fract(cwCrackPhase)-.5),cwAa=max(fwidth(cwCrackPhase),.005);
   float cwFissure=(1.-smoothstep(.005-cwAa,.005+cwAa,cwEdge))
                *smoothstep(.35,.75,sin(cwY*.58+cwAngle*5.))*.16;
   outgoingLight=mix(outgoingLight,vec3(0.09084171,0.09530747,0.14702727),cwFissure);
   outgoingLight=mix(outgoingLight,cwUnweathered,0.);
   }
   
  {
   vec3 pwP=coralWeatherP;
   float pwL=dot(outgoingLight,vec3(.299,.587,.114));
   float pwMx=max(outgoingLight.r,max(outgoingLight.g,outgoingLight.b)),pwMn=min(outgoingLight.r,min(outgoingLight.g,outgoingLight.b));
   float pwStone=1.-smoothstep(.16,.32,(pwMx-pwMn)/max(pwMx,.001));
   vec3 pwRamp=mix(vec3(0.158961,0.144128,0.234551),vec3(0.254152,0.230740,0.323143),smoothstep(.12,.34,pwL));
   outgoingLight=mix(outgoingLight,pwRamp*(.86+.32*pwL),pwStone*.78);
   float pwA=atan(pwP.z,pwP.x),pwS=pwA*max(length(pwP.xz),1.);
   float pwYc=pwP.y+.35*sin(pwS*.21)+.2*sin(pwS*.53+1.7);
   float pwRowF=pwYc/2.3,pwRow=floor(pwRowF);
   float pwLen=2.8+1.8*cwHash(vec3(pwRow,1.3,7.1));
   float pwColF=(pwS+cwHash(vec3(pwRow,5.,2.))*9.+.25*(pwYc-pwRow*2.3))/pwLen,pwCol=floor(pwColF);
   float pwAaH=max(fwidth(pwYc),1e-4),pwAaV=max(fwidth(pwS),1e-4);
   float pwH=1.-smoothstep(.05,.05+pwAaH,min(fract(pwRowF),1.-fract(pwRowF))*2.3);
   float pwV=1.-smoothstep(.05,.05+pwAaV,min(fract(pwColF),1.-fract(pwColF))*pwLen);
   float pwKeepH=step(.3,cwHash(vec3(floor(pwS/2.1),pwRow,3.))),pwKeepV=step(.22,cwHash(vec3(pwCol,pwRow,9.)));
   float pwLod=1.-smoothstep(.10,.30,max(pwAaH,min(pwAaV,1.)));
   float pwJoint=max(pwH*pwKeepH,pwV*pwKeepV)*pwLod;
   outgoingLight*=mix(1.,.93+.12*cwHash(vec3(pwCol,pwRow,4.2)),pwStone);
   float pwZone=smoothstep(24.60,25.60,pwP.y);
   outgoingLight=mix(outgoingLight,vec3(0.078187,0.068478,0.124772),pwJoint*pwZone*(.18+.24*pwStone));
   float pwDeep=1.-smoothstep(12.00,25.00,pwP.y);
   float pwUnder=1.-smoothstep(24.80,25.20,pwP.y);
   outgoingLight=mix(outgoingLight,mix(vec3(0.039546,0.502886,0.467784),vec3(0.013702,0.323143,0.381326),pwDeep),pwUnder*(.55+.3*pwDeep));
  }
  #ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif
	gl_FragColor = linearToOutputTexel( gl_FragColor );
	#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
	#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif
	#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif
}