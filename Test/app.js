//Check for webXR support
(async function() {
    const isArSessionSupported = navigator.xr && navigator.xr.isSessionSupported 
        && await navigator.xr.isSessionSupported("immersive-ar");
    if (isArSessionSupported) {
      document.getElementById("start-ar").addEventListener("click", window.app.activateXR)
    } else {
      onNoXRDevice();
    }
})();

function onNoXRDevice() {
    document.body.classList.add('unsupported');
}


//Container class for app
class App{
    activateXR = async () => {
        try{
            this.session = await navigator.xr.requestSession("immersive-ar", {
                requiredFeatures: ['hit-test', 'dom-overlay'],
                domOverlay: { root: document.body }
              });
            this.createXRCanvas();
            await this.onSessionStarted();
        } catch (e) {
            console.log(e);
        }
    }

    createXRCanvas(){
        this.canvas = document.createElement("canvas");
        document.body.appendChild(this.canvas);
        this.gl = this.canvas.getContext("webgl", {xrCompatible: true});

        this.session.updateRenderState({
            baseLayer: new XRWebGLLayer(this.session, this.gl)
        });
    }

    onSessionStarted = async () => {
        document.body.classList.add('ar');
        this.setupThree();
 
        this.referenceSpace= await this.session.requestReferenceSpace('local');
        this.viewerSpace = await this.session.requestReferenceSpace("viewer");
        this.hitTestSource = await this.session.requestHitTestSource({ space: this.viewerSpace });

        this.session.requestAnimationFrame(this.onXRFrame);
        this.session.addEventListener("select", this.onSelect);

    }

    onSelect = () => {
        if (window.sunflower) {
          const clone = window.sunflower.clone();
          clone.position.copy(this.reticle.position);
          this.scene.add(clone)
    
          const shadowMesh = this.scene.children.find(c => c.name === 'shadowMesh');
          shadowMesh.position.y = clone.position.y;
        }
    }
    

    onXRFrame = (time, frame) => {
        this.session.requestAnimationFrame(this.onXRFrame);

        const framebuffer = this.session.renderState.baseLayer.framebuffer;
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
        this.renderer.setFramebuffer(framebuffer);

        const pose = frame.getViewerPose(this.referenceSpace);
        if (pose){
            const view  = pose.views[0];
            const viewport = this.session.renderState.baseLayer.getViewport(view);
            this.renderer.setSize(viewport.width, viewport.height);

            this.camera.matrix.fromArray(view.transform.matrix);
            this.camera.projectionMatrix.fromArray(view.projectionMatrix);
            this.camera.updateMatrixWorld(true);

            // Conduct hit test.
            const hitTestResults = frame.getHitTestResults(this.hitTestSource);

            // If we have results, consider the environment stabilized.
            if (!this.stabilized && hitTestResults.length > 0) {
                this.stabilized = true;
                document.body.classList.add('stabilized');
            }
            if (hitTestResults.length > 0) {
                const hitPose = hitTestResults[0].getPose(this.localReferenceSpace);

                // Update the reticle position
                this.reticle.visible = true;
                this.reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z)
                this.reticle.updateMatrixWorld(true);
            }   
            

            this.renderer.render(this.scene, this.camera);

        }
    }


    //Sets up three scene
    setupThree(){ 

        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true,
            canvas: this.canvas,
            context:this.gl
        });
        this.renderer.autoClear = false;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
       
        this.scene = DemoUtils.createLitScene();

        // Add lights and shadow material to scene.
        this.scene.add(shadowMesh);
        this.reticle = new Reticle();
        this.scene.add(this.reticle);


        this.camera = new THREE.PerspectiveCamera();
        this.camera.matrixAutoUpdate = false;
    
    }
};

window.app = new App();
