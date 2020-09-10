let _canvasVideo = null, _canvasAR = null;

// LIPS:
const SHAPELIPS = {
  // LIPS:
  points: [
    "lipsExt0", // 0
    "lipsExtTop1", // 1
    "lipsExtTop2", // 2
    "lipsExtTop3", // 3
    "lipsExtTop4", // 4
    "lipsExtTop5", // 5
    
    "lipsExt6", // 6

    "lipsExtBot7", // 7
    "lipsExtBot8", // 8
    "lipsExtBot9", // 9
    "lipsExtBot10", // 10
    "lipsExtBot11", // 11
    
    "lipsInt12", // 12

    "lipsIntTop13", // 13
    "lipsIntTop14", // 14
    "lipsIntTop15", // 15
    
    "lipsInt16", // 16

    "lipsIntBot17", // 17
    "lipsIntBot18", // 18
    "lipsIntBot19", // 19
  ],
  iVals: [ // interpolated values
    // LIPS:        
    [1], // lipsExt0
    [1], // lipsExtTop1
    [1], // lipsExtTop2
    [1], // lipsExtTop3
    [1], // lipsExtTop4
    [1], // lipsExtTop5
    
    [1], // lipsExt6

    [1], // lipsExtBot7
    [1], // lipsExtBot8
    [1], // lipsExtBot9
    [1], // lipsExtBot10
    [1], // lipsExtBot11
    
    [-1], // lipsInt12

    [-1], // lipsIntTop13
    [-1], // lipsIntTop14
    [-1], // lipsIntTop15
    
    [-1], // lipsInt16

    [-1], // lipsIntBot17
    [-1], // lipsIntBot18
    [-1] // lipsIntBot1
  ],
  tesselation: [ // each value is an index in points array
    // upper lip:
    0,1,13, // each group of 3 indices is a face
    0,12,13,
    1,13,2,
    2,13,14,
    2,3,14,
    3,4,14,
    14,15,4,
    4,5,15,
    15,5,6,
    15,6,16,

    // lower lip:
    0,12,19,
    0,19,11,
    11,10,19,
    10,18,19,
    10,9,18,
    8,9,18,
    8,17,18,
    7,8,17,
    6,7,17,
    6,17,16, //*/
  ],

  // interpolated points - compute cubic Hermite interpolation:
  interpolations: [
    { // upper lip sides:
      tangentInfluences: [2, 2, 2],
      points: [1, 2, 3],
      ks: [-0.25, 0.25] // between -1 and 1
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [3, 4, 5],
      ks: [-0.25, 0.25] // between -1 and 1
    },
    { // upper lip middle
      tangentInfluences: [2, 2, 2],
      points: [2, 3, 4],
      ks: [-0.25, 0.25] // between -1 and 1
    },
    { // lower lip middle:
      tangentInfluences: [2, 2, 2],
      points: [10, 9, 8],
      ks: [-0.25, 0.25] // between -1 and 1
    }
  ],

  // contours:
  outlines: [
    { // upper lip. Indices of points in points array:
      points: [
        0,
        1,2,3,4,5, // exterior
        6, 16,
        15, 14, 13, // interior
        12
      ],
      displacements: [ // displacements, relative to perimeter:
        0.00,
        0.0, 0.0, -0.015, 0.0, 0.0, // exterior
        0.00, 0,
        0.01, 0.015, 0.01, // interior
        0
      ]
    },
    { // lower lip:
      points: [
        12,
        19, 18, 17, // interior
        16, 6,
        7, 8, 9, 10, 11, // exterior
        0
      ],
      displacements: [
        0,
        0.015, 0.02, 0.015,
        0, 0.0,
        0,0,0,0,0,
        0.0
      ]
    }
  ],

  // RENDERING:
  // Debug interpolated vals:
  /*GLSLFragmentSource: "void main(void){\n\
    gl_FragColor = vec4(0.5 + 0.5*iVal, 0., 1.);\n\
  }" //*/

  // uniform color:
  /*GLSLFragmentSource: "void main(void){\n\
    gl_FragColor = vec4(0.1, 0.0, 0.2, 0.5);\n\
  }" //*/
  
  // debug samplerVideo and vUV:
  /*GLSLFragmentSource: "void main(void){\n\
    gl_FragColor = vec4(0., 1., 0., 1.) * texture2D(samplerVideo, vUV);\n\
  }" //*/

  // color with smooth border:
  GLSLFragmentSource: "\n\
    const vec2 ALPHARANGE = vec2(0.1, 0.9);\n\
    const vec3 LUMA = 1.3 * vec3(0.299, 0.587, 0.114);\n\
    const vec3 BASECOLOR = vec3(1.0, 0., 0.3);\n\
    \n\
    float linStep(float edge0, float edge1, float x){\n\
      float val = (x - edge0) / (edge1 - edge0);\n\
      return clamp(val, 0.0, 1.0);\n\
    }\n\
    \n\
    \n\
    void main(void){\n\
      // get grayscale video color:\n\
      vec3 videoColor = texture2D(samplerVideo, vUV).rgb;\n\
      vec3 videoColorGs = vec3(1., 1., 1.) * dot(videoColor, LUMA);\n\
      \n\
      // computer alpha:\n\
      float alpha = 1.0; // no border smoothing\n\
      alpha *= linStep(-1.0, -0.95, abs(iVal)); // interior\n\
      alpha *= linStep(1.0, 0.6, abs(iVal)); // exterior smoothing\n\
      float alphaClamped = ALPHARANGE.x + (ALPHARANGE.y - ALPHARANGE.x) * alpha;\n\
      \n\
      // mix colors:\n\
      vec3 color = videoColorGs * BASECOLOR;\n\
      gl_FragColor = vec4(color*alpha, alphaClamped);\n\
      \n\
      //gl_FragColor = vec4(alpha, alpha, alphaClamped, 1.0); // for debugging\n\
      //gl_FragColor = vec4(0., 1., 0., 1.); // for debugging\n\
    }" //*/
}; // END SHAPELIPS


const SHAPEEYES = {
  points: [
    "eyeRightInt0", // 0
    "eyeRightTop0",
    "eyeRightTop1",
    "eyeRightExt0",
    "eyeRightOut0",
    "eyeRightOut1", // 5
    "eyeRightOut2",
    "eyeRightOut3",

    "eyeLeftInt0",
    "eyeLeftTop0",
    "eyeLeftTop1", // 10
    "eyeLeftExt0",
    "eyeLeftOut0",
    "eyeLeftOut1",
    "eyeLeftOut2",
    "eyeLeftOut3" // 15
  ],
  iVals: [
    [1], // eyeRightInt0 20
    [1], // eyeRightTop0
    [1], // eyeRightTop1
    [1], // eyeRightExt0
    [1], // eyeRightOut0
    [-1], // eyeRightOut1
    [-1], // eyeRightOut2
    [-1], // eyeRightOut3

    [1], // eyeLeftInt0
    [1], // eyeLeftTop0
    [1], // eyeLeftTop1 30
    [1], // eyeLeftExt0
    [1], // eyeLeftOut0
    [-1], // eyeLeftOut1
    [-1], // eyeLeftOut2
    [-1] // eyeLeftOut3 35
  ],
  tesselation: [
    // upper right eye;
    0,6,7,
    0,1,6,
    1,5,6,
    2,5,1,
    2,4,5,
    3,4,2,
    
    // upper left eye:
    8,15,14,
    9,8,14,
    14,13,9,
    9,13,10,
    10,13,12,
    11,10,12
  ],
  interpolations: [
    // top of right eye smoother:
    {
      tangentInfluences: [2, 2, 2],
      points: [0, 1, 2],
      ks: [-0.5, 0.5] // between -1 and 1
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [0, 1, 2],
      ks: [0.5, -0.5] // between -1 and 1
    },

    // right eyebrow smoother:
    {
      tangentInfluences: [2, 2, 2],
      points: [3, 4, 5],
      ks: [0.5, -0.5] // between -1 and 1
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [4, 5, 6],
      ks: [-0.5, 0.5] // between -1 and 1
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [5, 6, 7],
      ks: [-0.5, 0.5] // between -1 and 1
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [6, 7, 0],
      ks: [-0.5, 0.5] // between -1 and 1
    },

    // top of left eye smoother:
    {
      tangentInfluences: [2, 2, 2],
      points: [8, 9, 10],
      ks: [-0.5, 0.5] // between -1 and 1
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [8, 9, 10],
      ks: [0.5, -0.5] // between -1 and 1
    },

    // left eyebrow smoother:
    {
      tangentInfluences: [2, 2, 2],
      points: [11, 12, 13],
      ks: [0.5, -0.5] // between -1 and 1
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [12, 13, 14],
      ks: [-0.5, 0.5] // between -1 and 1
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [13, 14, 15],
      ks: [-0.5, 0.5] // between -1 and 1
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [14, 15, 8],
      ks: [-0.5, 0.5] // between -1 and 1
    }
  ],
  outlines: [
    // right top eye higher:
    {
      points: [0,1,2,3,4,5,6,7],
      displacements: [-0.07,-0.03,-0.01,-0.05,0,0,0,0]
    },
    // left eye:
    {
      points: [8,9,10,11,12,13,14,15],
      displacements: [-0.07,-0.03,-0.01,-0.05,0,0,0,0]
    }
  ],
  GLSLFragmentSource: "void main(void){\n\
    float alphaMax = 0.6;\n\
    vec3 makeupColor = vec3(0.4, 0.1, 1.0);\n\
    float borderHardness = 0.6; // 0.001 -> very hard, 1 -> soft border\n\
    float alpha = alphaMax * pow(0.5 + iVal * 0.5, borderHardness);\n\
    gl_FragColor = vec4(alpha * makeupColor, alpha);\n\
    // DEBUG:\n\
    //gl_FragColor = vec4(0., 1., 0., 1.);\n\
  }"
}; //end SHAPEEYES


const SHAPECHEEKS = {
  points: [
    "cheekRightExt0", // 36
    "cheekRightExt1",
    "cheekRightExt2",
    "cheekRightExt3",
    "cheekRightExt4", // 40
    "cheekRightExt5",
    "cheekRightInt0",

    "cheekLeftExt0",
    "cheekLeftExt1",
    "cheekLeftExt2", // 45
    "cheekLeftExt3",
    "cheekLeftExt4",
    "cheekLeftExt5",
    "cheekLeftInt0"  // 49
  ],
  iVals: [
    [-1], // cheekRightExt0
    [-1], // cheekRightExt1
    [-1], // cheekRightExt2
    [-1], // cheekRightExt3
    [-1], // cheekRightExt4 40
    [-1], // cheekRightExt5
    [1], // cheekRightInt0

    [-1], // cheekLeftExt0
    [-1], // cheekLeftExt1
    [-1], // cheekLeftExt2 45
    [-1], // cheekLeftExt3
    [-1], // cheekLeftExt4
    [-1], // cheekLeftExt5
    [1] // cheekLeftInt0 49
  ],
  tesselation: [
    // right cheek:
    0,1,6,
    1,2,6,
    2,3,6,
    3,4,6,
    4,5,6,
    5,0,6, //*/

    // left cheek:
    7,8,13,
    8,9,13,
    9,10,13,
    10,11,13,
    11,12,13,
    12,7,13
  ],
  interpolations: [
  ],
  outlines: [
  ],
  GLSLFragmentSource: "void main(void){\n\
    float alphaMax = 0.5;\n\
    vec3 blushColor = vec3(0.91, 0.79, 0.76);\n\
    float borderHardness = 0.4; // 0.001 -> very hard, 1 -> soft border\n\
    float alpha = alphaMax * pow(0.5 + iVal * 0.5, borderHardness);\n\
    gl_FragColor = vec4(alpha * blushColor, alpha);\n\
  }"
}; //end SHAPECHEEKS

function start(){
  WebARRocksFaceShape2DHelper.init({
    NNCpath: '../../neuralNets/NN_MAKEUP_0.json',
    canvasVideo: _canvasVideo,
    canvasAR:_canvasAR,
    shapes: [SHAPELIPS, SHAPEEYES, SHAPECHEEKS]
  }).then(function(){
    console.log('READY');
  }).catch(function(err){
    throw new Error(err);
  });
}

// entry point:
function main(){
  _canvasAR = document.getElementById('WebARRocksFaceCanvasAR');
  _canvasVideo = document.getElementById('WebARRocksFaceCanvasVideo');
  
  WebARRocksResizer.size_canvas({
    canvas: _canvasVideo,
    overlayCanvas: [_canvasAR],
    callback: start,
    isFullScreen: true
  });
}