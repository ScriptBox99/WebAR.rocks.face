
function init_evaluators(){
  // run WEBARROCKSFACE.get_LMLabels() in the web console
  // to get landmarks labels provided by the current neural network
  
  // MOUTH OPEN:
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('OPEN_MOUTH', {
    refLandmarks: ["lowerLipBot", "chin"],
    landmarks: ["lowerLipBot", "upperLipTop"],
    range: [0.65, 1.2],
    isInv: false,
    isDebug: true
  });

  // MOUTH SMILE:
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('SMILE', {
    refLandmarks: ["mouthLeft", "mouthRight"],
    landmarks: ["lowerLipBot", "upperLipTop"],
    range: [0.22, 0.35],
    isInv: true,
    isDebug: true
  });

  // OPEN/CLOSE EYES:
  const closeEyeEvaluatorParams = {
    range: [0.15, 0.25],
    isInv: true,
    isDebug: true,
    delayMinMs: 500
  };
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('CLOSE_LEFT_EYE', Object.assign({
    refLandmarks: ["leftEyeInt", "leftEyeExt"],
    landmarks: ["leftEyeTop", "leftEyeBot"]
  }, closeEyeEvaluatorParams));
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('CLOSE_RIGHT_EYE', Object.assign({
    refLandmarks: ["rightEyeInt", "rightEyeExt"],
    landmarks: ["rightEyeTop", "rightEyeBot"]
  }, closeEyeEvaluatorParams));
  //*/

  // EYEBROWS UP:
  const eyebrowUpEvaluatorParams = {
    range: [1.2, 1.5],
    isDebug: true,
    delayMinMs: 500
  };
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROW_RIGHT_UP', Object.assign({
    refLandmarks: ["rightEyeInt", "rightEyeExt"],
    landmarks: ["rightEyeBot", "rightEyeBrowCenter"]
  }, eyebrowUpEvaluatorParams));
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROW_LEFT_UP', Object.assign({
    refLandmarks: ["leftEyeInt", "leftEyeExt"],
    landmarks: ["leftEyeBot", "leftEyeBrowCenter"]
  }, eyebrowUpEvaluatorParams));

  // EYEBROWS DOWN:
  const eyebrowDownEvaluatorParams = {
    range: [1.0, 1.15],
    isInv: true,
    isDebug: true,
    delayMinMs: 500
  };
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROW_RIGHT_DOWN', Object.assign({
    refLandmarks: ["rightEyeInt", "rightEyeExt"],
    landmarks: ["rightEyeBot", "rightEyeBrowCenter"]
  }, eyebrowDownEvaluatorParams));
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROW_LEFT_DOWN', Object.assign({
    refLandmarks: ["leftEyeInt", "leftEyeExt"],
    landmarks: ["leftEyeBot", "leftEyeBrowCenter"]
  }, eyebrowDownEvaluatorParams));

  // COMPOSITE EVALUATORS:
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('WINK', {
    computeFrom: ['CLOSE_LEFT_EYE', 'CLOSE_RIGHT_EYE'],
    operator: 'MEAN',
    isDebug: true,
    delayMinMs: 500
  });
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROWS_UP', {
    computeFrom: ['EYEBROW_RIGHT_UP', 'EYEBROW_LEFT_UP'],
    operator: 'MEAN',
    isDebug: true,
    delayMinMs: 500
  });
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROWS_DOWN', {
    computeFrom: ['EYEBROW_RIGHT_DOWN', 'EYEBROW_LEFT_DOWN'],
    operator: 'MEAN',
    isDebug: true,
    delayMinMs: 500
  });

}



function init_triggers(){
  WebARRocksFaceExpressionsEvaluator.add_trigger('OPEN_MOUTH', {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function(){
      console.log('TRIGGER FIRED - MOUTH OPEN');
    },
    onEnd: function(){
      console.log('TRIGGER FIRED - MOUTH CLOSED');
    }
  });
  WebARRocksFaceExpressionsEvaluator.add_trigger('SMILE', {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function(){
      console.log('TRIGGER FIRED - SMILE');
    },
    onEnd: function(){
      console.log('TRIGGER FIRED - NOT SMILE');
    }
  });
  WebARRocksFaceExpressionsEvaluator.add_trigger('WINK', {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function(){
      console.log('TRIGGER FIRED - WINK');
    },
    onEnd: function(){
      console.log('TRIGGER FIRED - NOT WINK');
    }
  });
  WebARRocksFaceExpressionsEvaluator.add_trigger('EYEBROWS_UP', {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function(){
      console.log('TRIGGER FIRED - EYEBROWS UP');
    },
    onEnd: function(){
      console.log('TRIGGER FIRED - NOT EYEBROWS UP');
    }
  });
  WebARRocksFaceExpressionsEvaluator.add_trigger('EYEBROWS_DOWN', {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function(){
      console.log('TRIGGER FIRED - EYEBROWS DOWN');
    },
    onEnd: function(){
      console.log('TRIGGER FIRED - NOT EYEBROWS DOWN');
    }
  });
}


function start(){
  WebARRocksFaceDebugHelper.init({
    spec: {
      NNCPath: '../../neuralNets/NN_AUTOBONES_3.json'
    }, // keep default specs
    callbackReady: function(err, spec){
      init_evaluators();
      init_triggers();
    },
    callbackTrack: function(detectState){
      const expressionsValues = WebARRocksFaceExpressionsEvaluator.evaluate_expressions(detectState);
      //console.log(expressionsValues.OPEN_MOUTH);
      WebARRocksFaceExpressionsEvaluator.run_triggers(expressionsValues);      
    }
  })
}

function main(){
  WebARRocksResizer.size_canvas({
    canvasId: 'WebARRocksFaceCanvas',
    callback: start
  })
}