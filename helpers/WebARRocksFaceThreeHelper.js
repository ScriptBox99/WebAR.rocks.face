/**
 * Copyright 2020 WebAR.rocks ( https://webar.rocks )
 * 
 * WARNING: YOU SHOULD NOT MODIFY THIS FILE OTHERWISE WEBAR.ROCKS
 * WON'T BE RESPONSIBLE TO MAINTAIN AND KEEP YOUR ADDED FEATURES
 * WEBAR.ROCKS WON'T BE LIABLE FOR BREAKS IN YOUR ADDED FUNCTIONNALITIES
 *
 * WEBAR.ROCKS KEEP THE RIGHT TO WORK ON AN UNMODIFIED VERSION OF THIS SCRIPT.
 * 
 * THIS FILE IS A HELPER AND SHOULD NOT BE MODIFIED TO IMPLEMENT A SPECIFIC USER SCENARIO
 * OR TO ADDRESS A SPECIFIC USE CASE.
 */


const WebARRocksFaceThreeHelper = (function(){
  const _settings = {
    cameraMinVideoDimFov: 38, // min camera FoV in degrees (either horizontal or vertical depending on the camera)
    
    // debug options:
    debugObjPoints: 0 // display cubes on 3D landmark points - to debug pose computation
  };


  const _defaultSolvePnPObjPointsPositions = { // 3d positions, got using Blender in edit mode and opening dev/face.obj
                        // the value added as comment is the point indice
    'leftEyeCtr': [33.7,37.9,45.9], // 6022
    'rightEyeCtr':[-33.7,37.9,45.9], // 5851

    'leftEyeInt': [16,36,40], // 6026
    'rightEyeInt':[-16,36,40], // 5855

    'leftEyeExt': [46,37.9,38],  // 1808
    'rightEyeExt':[-46,37.9,38], // 2214

    'leftEyeBot': [33,31,45], // 2663
    'rightEyeBot':[-33,31,45], // 4462

    'leftEarBottom': [77,-18.6,-18], // 65
    'rightEarBottom': [-77,-18.6,-18], // 245

    'leftEarEarring': [81, -37, -24.8], // 3874
    'rightEarEarring': [-81, -37, -24.8], // 5625
    
    'noseLeft': [21,-0.1,67], // 1791
    'noseRight': [-21,-0.1,67], // 2198

    'noseBottom': [0, -0.6, 82], // 468
    'noseOuter': [0, 15.4, 93], // 707

    "mouthLeft":  [27, -29.9, 70.8], // 32
    "mouthRight": [-27, -29.9, 70.8], // 209

    "upperLipBot": [0, -24, 83.5], // 3072
    "upperLipTop": [0, -17.2, 86.3],// 595
    "lowerLipTop": [0, -26, 84.3],// 627
    "lowerLipBot": [0, -34, 89.6],// 2808

    "leftEyeBrowInt": [15, 55.4, 51.2], // 3164
    "rightEyeBrowInt": [-15, 55.4, 51.2], // 4928
    
    'chin':  [0, -71, 91] // 2395  //*/
  };
  const _defaultSolvePnPImgPointsLabel = ['chin', 'leftEarBottom', 'rightEarBottom', 'noseOuter', 'leftEyeExt', 'rightEyeExt'];
    
  const _deg2rad = Math.PI / 180;
  let _cameraFoVY = -1;
  let _spec = null;
  let _stabilizers = null;

  const _shps = { // shader programs
    copy: null
  };

  let _gl = null, _cv = null, _glVideoTexture = null, _videoTransformMat2 = null;
  let _videoElement = null;
  const _focals = [0, 0];

  const _landmarks = {
    labels: null,
    indices: {}
  };
 
  const _computePose = {    
    isCenterObjPoints: true,
    objPoints: [], // will be sorted by solver
    objPointsMean: null,
    imgPointsLMIndices: [], // will be sorted by solver
    imgPointsPx: []
  };
  const _three = {
    isPostProcessing: false,
    taaLevel: 0,
    canvas: null,
    renderer: null,
    composer: null,
    scene: null,
    camera: null,
    faceSlots: [],
    matMov: null,
    vecForward: null
  };

  // compile a shader:
  function compile_shader(source, glType, typeString) {
    const glShader = _gl.createShader(glType);
    _gl.shaderSource(glShader, source);
    _gl.compileShader(glShader);
    if (!_gl.getShaderParameter(glShader, _gl.COMPILE_STATUS)) {
      alert("ERROR IN " + typeString + " SHADER: " + _gl.getShaderInfoLog(glShader));
      console.log('Buggy shader source: \n', source);
      return null;
    }
    return glShader;
  };

  // build the shader program:
  function build_shaderProgram(shaderVertexSource, shaderFragmentSource, id) {
    // compile both shader separately:
    const GLSLprecision = 'precision lowp float;';
    const glShaderVertex = compile_shader(shaderVertexSource, _gl.VERTEX_SHADER, "VERTEX " + id);
    const glShaderFragment = compile_shader(GLSLprecision + shaderFragmentSource, _gl.FRAGMENT_SHADER, "FRAGMENT " + id);

    const glShaderProgram = _gl.createProgram();
    _gl.attachShader(glShaderProgram, glShaderVertex);
    _gl.attachShader(glShaderProgram, glShaderFragment);

    // start the linking stage:
    _gl.linkProgram(glShaderProgram);
    const aPos = _gl.getAttribLocation(glShaderProgram, "position");
    _gl.enableVertexAttribArray(aPos);

    return {
      program: glShaderProgram,
      uniforms:{}
    };
  }

  function update_focals(){
    // COMPUTE CAMERA PARAMS (FOCAL LENGTH)
    // see https://docs.opencv.org/3.0-beta/modules/calib3d/doc/camera_calibration_and_3d_reconstruction.html?highlight=projectpoints
    // and http://ksimek.github.io/2013/08/13/intrinsic/

    const halfFovYRad = 0.5 * _cameraFoVY * _deg2rad;
    
    // settings with EPnP:
    const fy = 0.5 * that.get_viewHeight() / Math.tan(halfFovYRad);
    const fx = fy;

    /*const halfFovXRad =halfFovYRad * that.get_viewAspectRatio();
    const cotanHalfFovX = 1.0 / Math.tan(halfFovXRad);
    const fx = 0.5 * that.get_viewWidth() * cotanHalfFovX; //*/

    console.log('INFO in WebARRocksFaceThreeHelper - focal_y =', fy);
    _focals[0] = fy, _focals[1] = fy;
  }

  function init_PnPSolver(imgPointsLabels, objPointsPositions){
    const imgPointsPx = [];
    for (let i=0; i<imgPointsLabels.length; ++i){
      imgPointsPx.push([0, 0]);
    }
    _computePose.imgPointsPx = imgPointsPx;
    _computePose.imgPointsLMIndices = imgPointsLabels.map(
      function(label, ind){
        return _landmarks.labels.indexOf(label);
      });
    _computePose.objPoints = imgPointsLabels.map(
      function(label, ind){
        return objPointsPositions[label].slice(0);
      }); 

    if (_computePose.isCenterObjPoints){
      // compute mean:
      const mean = [0, 0, 0];        
      _computePose.objPoints.forEach(function(pt){
        mean[0] += pt[0], mean[1] += pt[1], mean[2] += pt[2];
      });
      const n = _computePose.objPoints.length;
      mean[0] /= n, mean[1] /= n, mean[2] /= n;
      _computePose.objPointsMean = mean;

      // substract mean:
      _computePose.objPoints.forEach(function(pt){
        pt[0] -= mean[0], pt[1] -= mean[1], pt[2] -= mean[2];
      });      
    } //end if center obj points
  }

  function init_three(maxFacesDetected){
    console.log('INFO in WebARRocksFaceThreeHelper - init_three(). Max faces detected = ', maxFacesDetected);

    _three.canvas = _spec.canvasThree;
    _three.isPostProcessing = _spec.isPostProcessing;
    _three.taaLevel = _spec.taaLevel;
    if ( _three.taaLevel > 0 ){
      _three.isPostProcessing = true;
    }

    _three.renderer = new THREE.WebGLRenderer({
      canvas: _three.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    _three.renderer.setClearAlpha(0);
    
    _three.scene = new THREE.Scene();
    _three.camera = new THREE.PerspectiveCamera(_cameraFoVY, that.get_viewAspectRatio(), 10, 5000);
    
    if (_three.isPostProcessing){
      _three.composer = new THREE.EffectComposer( _three.renderer );
      const renderScenePass = new THREE.RenderPass( _three.scene, _three.camera );
      if (_three.taaLevel > 0){
        // add temporal anti-aliasing pass:
        const taaRenderPass = new THREE.TAARenderPass( _three.scene, _three.camera );
        taaRenderPass.unbiased = false;
        _three.composer.addPass( taaRenderPass );
        taaRenderPass.sampleLevel = _three.taaLevel;
      }

      _three.composer.addPass( renderScenePass );

      if (_three.taaLevel > 0){
        renderScenePass.enabled = false;
        const copyPass = new THREE.ShaderPass( THREE.CopyShader );
        _three.composer.addPass( copyPass );
      }

    } // end if postprocessing

    // create face slots objects:
    _three.faceSlots = [];
    for (let i=0; i<maxFacesDetected; ++i){
      // create composite object (which follow the head):
      const faceFollowerParent = new THREE.Object3D();
      const faceFollower = new THREE.Object3D();
      faceFollowerParent.frustumCulled = false;
      faceFollowerParent.visible = false;
      faceFollowerParent.matrixAutoUpdate = false;
      faceFollowerParent.add(faceFollower);
      _three.faceSlots.push({
        faceFollower: faceFollower,
        faceFollowerParent: faceFollowerParent
      });
      _three.scene.add(faceFollowerParent);
    }

    // debug pose computation face objPoints:
    if (_settings.debugObjPoints){
      const objPointsPositions = _spec.solvePnPObjPointsPositions;
      Object.keys(objPointsPositions).forEach(function(objPointKey){
        const objPoint = objPointsPositions[objPointKey];
        const s = 3;
        const debugCube = new THREE.Mesh(new THREE.BoxGeometry( s, s, s ), new THREE.MeshBasicMaterial({
          color: 0xff0000
        }));
        debugCube.position.fromArray(objPoint);
        _three.faceSlots[0].faceFollower.add(debugCube);
      });
    }

    _three.matMov = new THREE.Matrix4();
    _three.vecForward = new THREE.Vector4();
      
    that.update_threeCamera();
  }

  
  function callbackReady(err, spec){
    if (err){
      console.log('ERROR in WebARRocksFaceThreeHelper. ERR =', err);
      if (_spec.callbackReady){
        _spec.callbackReady(err, null);
      }
      return;
    }

    console.log('INFO in WebARRocksFaceThreeHelper: WebAR.Rocks.face is ready. spec =', spec);
    
    _gl = spec.GL;
    _cv = spec.canvasElement;
    _glVideoTexture = spec.videoTexture;
    _videoTransformMat2 = spec.videoTransformMat2;
    _landmarks.labels = spec.landmarksLabels;
    _videoElement = spec.video;

    console.log('INFO in WebARRocksFaceThreeHelper: video resolution =', _videoElement.videoWidth, 'x', _videoElement.videoHeight);

    _landmarks.labels.forEach(function(label, ind){
      _landmarks.indices[label] = ind;
    });

    // init stabilizer:
    if (typeof(WebARRocksLMStabilizer) === 'undefined' ){
      _stabilizers = null;
      console.warn("WARNING in WebARRocksFaceThreeHelper: cannot find WebARRocksLMStabilizer. Points won't be stabilized");
    } else {
      _stabilizers = {};
    }

    init_shps();
    init_three(spec.maxFacesDetected);
    
    update_focals();
    init_PnPSolver(_spec.solvePnPImgPointsLabels, _spec.solvePnPObjPointsPositions);
  
    if (_spec.callbackReady){
      spec.threeFaceFollowers = _three.faceSlots.map(function(faceSlot){
        return faceSlot.faceFollower;
      });
      spec.threeScene = _three.scene;
      spec.threeRenderer = _three.renderer;
      spec.threeComposer = _three.composer;
      spec.threeCamera = _three.camera;
      _spec.callbackReady(err, spec);
    }
  } //end callbackReady()

  function callbackTrack(detectStates){
    _gl.viewport(0, 0, that.get_viewWidth(), that.get_viewHeight());
   
    // draw the video:
    draw_video();
    
    let landmarksStabilized = null;
    if (detectStates.length){ // multiface detection:
      landmarksStabilized = detectStates.map(process_faceSlot);
    } else { // only 1 face detected
      landmarksStabilized = process_faceSlot(detectStates, 0);
    }
    
    render_three();
    
    if (_spec.callbackTrack){
      _spec.callbackTrack(detectStates, landmarksStabilized);
    }
  } //end callbackTrack
  
  function draw_video(){
    // use the head draw shader program and sync uniforms:
    _gl.useProgram(_shps.copyCrop.program);
    _gl.uniformMatrix2fv(_shps.copyCrop.uniforms.transformMat2, false, _videoTransformMat2);
    _gl.activeTexture(_gl.TEXTURE0);
    _gl.bindTexture(_gl.TEXTURE_2D, _glVideoTexture);

    // draw the square looking for the head
    // the VBO filling the whole screen is still bound to the context
    // fill the viewPort
    _gl.drawElements(_gl.TRIANGLES, 3, _gl.UNSIGNED_SHORT, 0);
  }

  function process_faceSlot(detectState, slotIndex){
    let landmarksStabilized = null;
    const faceSlot = _three.faceSlots[slotIndex];
    if (detectState.isDetected) {
      
      let landmarks = null;
      if (_stabilizers === null){
        landmarksStabilized = detectState.landmarks;
      } else {
        if (!_stabilizers[slotIndex]){
          _stabilizers[slotIndex] = WebARRocksLMStabilizer.instance({});
        };
        landmarksStabilized = _stabilizers[slotIndex].update(detectState.landmarks, that.get_viewWidth(), that.get_viewHeight());
      }

      compute_pose(landmarksStabilized, faceSlot);
      
      faceSlot.faceFollowerParent.visible = true;      
    } else if (faceSlot.faceFollowerParent.visible){
      faceSlot.faceFollowerParent.visible = false;
      if (_stabilizers && _stabilizers[slotIndex]){
        _stabilizers[slotIndex].reset();
      }
    }

    return landmarksStabilized;
  }

  function compute_pose(landmarks, faceSlot){
    const w2 = that.get_viewWidth() / 2;
    const h2 = that.get_viewHeight() / 2;
    const imgPointsPx = _computePose.imgPointsPx;

    _computePose.imgPointsLMIndices.forEach(function(ind, i){
      const imgPointPx = imgPointsPx[i];
      imgPointPx[0] = - landmarks[ind][0] * w2,  // X in pixels
      imgPointPx[1] = - landmarks[ind][1] * h2;  // Y in pixels
    });

    const objectPoints = _computePose.objPoints;
    const solved = WEBARROCKSFACE.compute_pose(objectPoints, imgPointsPx, _focals[0], _focals[1]);

    if (solved){
      const m = _three.matMov.elements;
      const r = solved.rotation, t = solved.translation;

      // set translation part:
      m[12] = -t[0], m[13] = -t[1], m[14] = -t[2];

      // set rotation part:
      m[0] = -r[0][0], m[4] =  -r[0][1], m[8] =  r[0][2],
      m[1] = -r[1][0], m[5] =  -r[1][1], m[9] =  r[1][2],
      m[2] = -r[2][0], m[6] =  -r[2][1], m[10] =  r[2][2];

      // do not apply matrix if the resulting face is looking in the wrong way:
      const vf = _three.vecForward;
      vf.set(0, 0, 1, 0); // look forward;
      vf.applyMatrix4(_three.matMov);
      if (vf.z > 0){
        faceSlot.faceFollowerParent.matrix.copy(_three.matMov);
        if (_computePose.isCenterObjPoints){
          const mean = _computePose.objPointsMean;
          faceSlot.faceFollower.position.fromArray(mean).multiplyScalar(-1);
        }
      }
    }
  }

  function render_three(){
    if (_three.isPostProcessing){
      _three.composer.render();
    } else {
      _three.renderer.render(_three.scene, _three.camera);
    }    
  }

  // build shader programs:
  function init_shps(){
    
    // create copy shp, used to display the video on the canvas:
    _shps.copyCrop = build_shaderProgram('attribute vec2 position;\n\
      uniform mat2 transform;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        vUV = 0.5 + transform * position;\n\
        gl_Position = vec4(position, 0., 1.);\n\
      }'
      ,
      'uniform sampler2D uun_source;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        gl_FragColor = texture2D(uun_source, vUV);\n\
      }',
      'COPY CROP');
    _shps.copyCrop.uniforms.transformMat2 = _gl.getUniformLocation(_shps.copyCrop.program, 'transform');
  }

  
  const that = {
    init: function(spec){
      _spec = Object.assign({
        spec: {},

        // pose computation (SolvePnP):
        solvePnPObjPointsPositions: _defaultSolvePnPObjPointsPositions,
        solvePnPImgPointsLabels: _defaultSolvePnPImgPointsLabel,

        // THREE specifics:
        canvasThree: null,
        isPostProcessing: false,
        taaLevel: 0,

        // callbacks:
        callbackReady: null,
        callbackTrack: null
      }, spec);
      
      // init WEBAR.rocks.face:WEBARROCKSFACE
      const defaultSpecLM = {
        canvas: null,
        canvasId: 'WebARRocksFaceCanvas',
        NNCPath: '../../neuralNets/',
        callbackReady: callbackReady,
        callbackTrack: callbackTrack
      };
      _spec.spec = Object.assign({}, defaultSpecLM, spec.spec);
      if (_spec.spec.canvas === null){
        _spec.spec.canvas = document.getElementById(_spec.spec.canvasId);
      }
      WEBARROCKSFACE.init(_spec.spec);
    },

    get_facePointPositions: function(){
      return _spec.solvePnPObjPointsPositions;
    },

    resize: function(w, h){ //should be called after resize
      _cv.width = w, _cv.height = h;
      _three.canvas.width = w;
      _three.canvas.height = h;
      WEBARROCKSFACE.resize();
      that.update_threeCamera();
      update_focals();
    },

    add_occluder: function(occluder, isDebug, occluderMesh){
      if (!occluderMesh){
        occluderMesh = new THREE.Mesh();
      }
      let occluderGeometry = null;
      if (occluder.type === 'BufferGeometry'){
        occluderGeometry = occluder;
      } else if (occluder.scene){
        occluder.scene.traverse(function(threeStuff){
          if (threeStuff.type !== 'Mesh'){
            return;
          }
          if (occluderGeometry !== null && occluderGeometry !== threeStuff.geometry){
            throw new Error('The occluder should contain only one Geometry');
          }
          occluderGeometry = threeStuff.geometry;
        });
      } else {
        throw new Error('Wrong occluder data format');
      }
      
      let mat = new THREE.ShaderMaterial({
        vertexShader: THREE.ShaderLib.basic.vertexShader,
        fragmentShader: "precision lowp float;\n void main(void){\n gl_FragColor = vec4(1.,0.,0.,1.);\n }",
        uniforms: THREE.ShaderLib.basic.uniforms,
        side: THREE.DoubleSide,
        colorWrite: false
      });
      if (isDebug){
        occluderGeometry.computeVertexNormals(); mat = new THREE.MeshNormalMaterial({side: THREE.DoubleSide});
      }
      occluderMesh.renderOrder = -1e12; // render first
      occluderMesh.material = mat;
      occluderMesh.geometry = occluderGeometry;
      occluderMesh.userData.isOccluder = true;

      _three.faceSlots.forEach(function(faceSlot){
        faceSlot.faceFollower.add(occluderMesh.clone());
      });
    },

    add_occluderFromFile: function(occluderURL, callback, threeLoadingManager, isDebug){
      const occluderMesh = new THREE.Mesh();
      const extension = occluderURL.split('.').pop().toUpperCase();
      const loader = {
        'GLB': THREE.GLTFLoader,
        'GLTF': THREE.GLTFLoader,
        'JSON': THREE.BufferGeometryLoader
      }[extension];

      new loader(threeLoadingManager).load(occluderURL, function(occluder){
        that.add_occluder(occluder, isDebug, occluderMesh);
        if (typeof(callback)!=='undefined' && callback) callback(occluderMesh);
      });
      return occluderMesh;
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

    update_solvePnP: function(objPointsPositions, imgPointsLabels){
      if (objPointsPositions){
        _spec.solvePnPObjPointsPositions = Object.assign(_spec.solvePnPObjPointsPositions, objPointsPositions);
      }
      _spec.solvePnPImgPointsLabels = imgPointsLabels || _spec.solvePnPImgPointsLabels;
      init_PnPSolver(_spec.solvePnPImgPointsLabels, _spec.solvePnPObjPointsPositions);
    },

    update_threeCamera: function(){
      const threeCamera = _three.camera;
      const threeRenderer = _three.renderer;

      // compute aspectRatio:
      const cvw = that.get_viewWidth();
      const cvh = that.get_viewHeight();
      const canvasAspectRatio = cvw / cvh;

      // compute vertical field of view:
      const vw = that.get_sourceWidth();
      const vh = that.get_sourceHeight();
      const videoAspectRatio = vw / vh;
      const fovFactor = (vh > vw) ? (1.0 / videoAspectRatio) : 1.0;
      let fov = _settings.cameraMinVideoDimFov * fovFactor;
      
      if (canvasAspectRatio > videoAspectRatio) {
        const scale = cvw / vw;
        const cvhs = vh * scale;
        fov = 2 * Math.atan( (cvh / cvhs) * Math.tan(0.5 * fov * _deg2rad)) / _deg2rad;
      }
      _cameraFoVY = fov;
       console.log('INFO in WebARRocksFaceThreeHelper.update_threeCamera(): camera vertical estimated FoV is', fov, 'deg');

      // update projection matrix:
      threeCamera.aspect = canvasAspectRatio;
      threeCamera.fov = fov;
      threeCamera.updateProjectionMatrix();

      // update drawing area:
      threeRenderer.setSize(cvw, cvh, false);
      threeRenderer.setViewport(0, 0, cvw, cvh);
    },

    change_NN: function(NNUrl){
      return WEBARROCKSFACE.update({
        NNCPath: NNUrl
      }).then(function(){
        _landmarks.labels = WEBARROCKSFACE.get_LMLabels();        
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
  module.exports = WebARRocksFaceThreeHelper;
} catch(e){
  console.log('ES6 Module not exported');
}