/**
 * Copyright 2020 WebAR.rocks ( https://webar.rocks )
 * 
 * WARNING: YOU SHOULD NOT MODIFY THIS FILE OTHERWISE WEBAR.ROCKS
 * WON'T BE RESPONSIBLE TO MAINTAIN AND KEEP YOUR ADDED FEATURES
 * WEBAR.ROCKS WON'T BE LIABLE FOR BREAKS IN YOUR ADDED FUNCTIONNALITIES
 *
 * WEBAR.ROCKS KEEP THE RIGHT TO WORK ON AN UNMODIFIED VERSION OF THIS SCRIPT.
 * 
 * THIS FILE IS A HELPER AND SHOULD NOT BE USED TO IMPLEMENT A SPECIFIC USER SCENARIO
 * OR TO ADDRESS A SPECIFIC USE CASE.
 */

"use strict"

const WebARRocksFaceDebugHelper = (function(){
  const _settings = {
    pointSize: 5, // when landmarks are displayed, their size in pixels
  };

  let _spec = null;

  const _shps = { // shader programs
    drawPoints: null,
    copy: null
  };

  let _gl = null, _cv = null, _glVideoTexture = null;
  let _videoElement = null;

  const _landmarks = {
    labels: null,
    indices: {}
  };

  const _drawLandmarks = {
    vertices: null,
    glIndicesVBO: null,
    glVerticesVBO: null
  };

  // compile a shader:
  function compile_shader(source, type, typeString) {
    const shader = _gl.createShader(type);
    _gl.shaderSource(shader, source);
    _gl.compileShader(shader);
    if (!_gl.getShaderParameter(shader, _gl.COMPILE_STATUS)) {
      alert("ERROR IN " + typeString + " SHADER: " + _gl.getShaderInfoLog(shader));
      console.log('Buggy shader source: \n', source);
      return false;
    }
    return shader;
  };

  // build the shader program:
  function build_shaderProgram(shaderVertexSource, shaderFragmentSource, id) {
    // compile both shader separately:
    const GLSLprecision = 'precision lowp float;';
    const shaderVertex = compile_shader(shaderVertexSource, _gl.VERTEX_SHADER, "VERTEX " + id);
    const shaderFragment = compile_shader(GLSLprecision + shaderFragmentSource, _gl.FRAGMENT_SHADER, "FRAGMENT " + id);

    const shaderProgram = _gl.createProgram();
    _gl.attachShader(shaderProgram, shaderVertex);
    _gl.attachShader(shaderProgram, shaderFragment);

    // start the linking stage:
    _gl.linkProgram(shaderProgram);
    const aPos = _gl.getAttribLocation(shaderProgram, "position");
    _gl.enableVertexAttribArray(aPos);

    return {
      program: shaderProgram,
      uniforms:{}
    };
  }
  
  function init_drawLandmarks(){
    _drawLandmarks.vertices = new Float32Array(_landmarks.labels.length*2);

    // create vertex buffer objects:
    // VBO to draw only 1 point
    _drawLandmarks.glVerticesVBO = _gl.createBuffer();
    _gl.bindBuffer(_gl.ARRAY_BUFFER, _drawLandmarks.glVerticesVBO);
    _gl.bufferData(_gl.ARRAY_BUFFER, _drawLandmarks.vertices, _gl.DYNAMIC_DRAW);

    const indices = new Uint16Array(_landmarks.labels.length);
    for (let i=0; i<_landmarks.labels.length; ++i){
      indices[i] = i;
    }
    _drawLandmarks.glIndicesVBO = _gl.createBuffer();
    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, _drawLandmarks.glIndicesVBO);
    _gl.bufferData(_gl.ELEMENT_ARRAY_BUFFER, indices, _gl.STATIC_DRAW);
  }

  function callbackReady(err, spec){
    if (err){
      console.log('ERROR in WebARRocksFaceDebugHelper. ERR =', err);
      if (_spec.callbackReady){
        _spec.callbackReady(err, null);
      }
      return;
    }

    console.log('INFO in WebARRocksFaceDebugHelper: WebAR.Rocks.face is ready. spec =', spec);
    
    _gl = spec.GL;
    _cv = spec.canvasElement;
    _glVideoTexture = spec.videoTexture;
    _landmarks.labels = spec.landmarksLabels;
    _videoElement = spec.video;

    console.log('INFO in WebARRocksFaceDebugHelper: video resolution =', _videoElement.videoWidth, 'x', _videoElement.videoHeight);

    _landmarks.labels.forEach(function(label, ind){
      _landmarks.indices[label] = ind;
    });

    init_shps();
    init_drawLandmarks();
    
    if (_spec.callbackReady){
      _spec.callbackReady(err, spec);
    }
  } //end callbackReady()

  function callbackTrack(detectStates){
    _gl.viewport(0, 0, that.get_viewWidth(), that.get_viewHeight());
   
    // draw the video:
    draw_video();
    
    if (detectStates.length){ // multiface detection:
      detectStates.forEach(process_faceSlot);
    } else { // only 1 face detected
      process_faceSlot(detectStates, 0);
    }
    
    if (_spec.callbackTrack){
      _spec.callbackTrack(detectStates);
    }
  } //end callbackTrack

  function draw_video(){
    // use the head draw shader program and sync uniforms:
    _gl.useProgram(_shps.copy.program);
    _gl.activeTexture(_gl.TEXTURE0);
    _gl.bindTexture(_gl.TEXTURE_2D, _glVideoTexture);

    // draw the square looking for the head
    // the VBO filling the whole screen is still bound to the context
    // fill the viewPort
    _gl.drawElements(_gl.TRIANGLES, 3, _gl.UNSIGNED_SHORT, 0);
  }

  function process_faceSlot(detectState, slotIndex){
   if (detectState.isDetected) {
      
      // draw landmarks:
      draw_landmarks(detectState);
    }
  }

  function draw_landmarks(detectState){
    // copy landmarks:
    detectState.landmarks.forEach(copy_landmark);

    // draw landmarks:
    _gl.useProgram(_shps.drawPoints.program);

    _gl.bindBuffer(_gl.ARRAY_BUFFER, _drawLandmarks.glVerticesVBO);
    _gl.bufferData(_gl.ARRAY_BUFFER, _drawLandmarks.vertices, _gl.DYNAMIC_DRAW);
    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, _drawLandmarks.glIndicesVBO);
    _gl.vertexAttribPointer(0, 2, _gl.FLOAT, false, 8,0);

    _gl.drawElements(_gl.POINTS, _landmarks.labels.length, _gl.UNSIGNED_SHORT, 0);
  }

  function copy_landmark(lm, lmIndex){
    _drawLandmarks.vertices[lmIndex*2] =     lm[0]; // X
    _drawLandmarks.vertices[lmIndex*2 + 1] = lm[1]; // Y
  }

  // build shader programs:
  function init_shps(){
    
    // create copy shp, used to display the video on the canvas:
    _shps.copy = build_shaderProgram('attribute vec2 position;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        vUV = 0.5 * position + vec2(0.5,0.5);\n\
        gl_Position = vec4(position, 0., 1.);\n\
      }'
      ,
      'uniform sampler2D uun_source;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        gl_FragColor = texture2D(uun_source, vUV);\n\
      }',
      'COPY');

    // create LM display shader program:
    const shaderVertexSource = "attribute vec2 position;\n\
      void main(void) {\n\
        gl_PointSize = " + _settings.pointSize.toFixed(1) + ";\n\
        gl_Position = vec4(position, 0., 1.);\n\
      } ";
    // display lime color:
    const shaderFragmentSource = "void main(void){\n\
        gl_FragColor = vec4(0.,1.,0.,1.);\n\
      }";

    _shps.drawPoints = build_shaderProgram(shaderVertexSource, shaderFragmentSource, 'DRAWPOINT');    
  }


  const that = {
    init: function(spec){
      _spec = Object.assign({
        spec: {},
       
        // callbacks:
        callbackReady: null,
        callbackTrack: null
      }, spec);
      
      // init WEBAR.rocks.face:WEBARROCKSFACE
      const defaultSpecLM = {
        canvas: null,
        canvasId: 'WebARRocksFaceCanvas',
        NNCpath: '../../neuralNets/',
        callbackReady: callbackReady,
        callbackTrack: callbackTrack
      };
      _spec.spec = Object.assign({}, defaultSpecLM, spec.spec);
      if (_spec.spec.canvas === null){
        _spec.spec.canvas = document.getElementById(_spec.spec.canvasId);
      }
      WEBARROCKSFACE.init(_spec.spec);
    },

    resize: function(w, h){ //should be called after resize
      _cv.width = w, _cv.height = h;
      WEBARROCKSFACE.resize();      
    },

    get_sourceWidth: function(){
      return _videoElement.videoWidth;
    },

    get_sourceHeight: function(){
      return _videoElement.videoHeight;
    },

    get_viewWidth: function(){
      return _cv.width;
    },

    get_viewHeight: function(){
      return _cv.height;
    },

    get_viewAspectRatio: function(){
      return that.get_viewWidth() / that.get_viewHeight();
    },   

    change_NN: function(NNUrl){
      return WEBARROCKSFACE.update({
        NNCpath: NNUrl
      }).then(function(){
        _landmarks.labels = WEBARROCKSFACE.get_LMLabels();
        init_drawLandmarks();
      });
    },

    update_video: function(video){
      return new Promise(function(accept, reject){
        WEBARROCKSFACE.update_videoElement(video, function(){
          WEBARROCKSFACE.resize();
          accept();
        });
      });      
    }

  }; //end that
  return that;
})();

// Export ES6 module:
try {
  module.exports = WebARRocksFaceDebugHelper;
} catch(e){
  console.log('ES6 Module not exported');
}