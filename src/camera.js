import * as THREE from 'three';

export function createCamera(gameWindow) {
  const DEG2RAD = Math.PI / 180.0;
  const LEFT_MOUSE_BUTTON = 0;
  const MIDDLE_MOUSE_BUTTON = 1;
  const RIGHT_MOUSE_BUTTON = 2;
  const MIN_CAMERA_RADIUS = 2;
  const MAX_CAMERA_RADIUS = 20;
  const MIN_CAMERA_ELEVATION = 30;
  const MAX_CAMERA_ELEVATION = 90;
  const ROTATION_SENSITIVITY = 0.5;
  const ZOOM_SENSITIVITY = 0.02;
  const PAN_SENSITIVITY = -0.01;
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const camera = new THREE.PerspectiveCamera(75, gameWindow.offsetWidth / gameWindow.offsetHeight, 0.1, 1000);
  let cameraOrigin = new THREE.Vector3(0,2,1); 
  let cameraRadius = 10;  
  let cameraAzimuth = 45;
  let cameraElevation = 45;
  let isLeftMouseDown = false;
  let isRightMouseDown = false;
  let isMiddleMouseDown = false;
  let prevMouseX = 0;
  let prevMouseY = 0;
  updateCameraPosition();
  function onMouseDown(event) {
    console.log('mousedown');
   
    if (event.button === LEFT_MOUSE_BUTTON) {
      isLeftMouseDown = true;
    }
    if (event.button === MIDDLE_MOUSE_BUTTON) {
      isMiddleMouseDown = true;
    }
    if (event.button === RIGHT_MOUSE_BUTTON) {
      isRightMouseDown = true;
    }
  }
  function onMouseUp(event) {
    console.log('mouseup');
    
    if (event.button === LEFT_MOUSE_BUTTON) {
      isLeftMouseDown = false;
    }
    if (event.button === MIDDLE_MOUSE_BUTTON) {
      isMiddleMouseDown = false;
    }
    if (event.button === RIGHT_MOUSE_BUTTON) {
      isRightMouseDown = false;
    }
  }
  function onMouseMove(event) {
    console.log('mousemove');
    const deltaX = (event.clientX - prevMouseX);
    const deltaY = (event.clientY - prevMouseY);
    // Handles the rotation of the camera
    if (isLeftMouseDown) {
      cameraAzimuth += -(deltaX * ROTATION_SENSITIVITY);
      cameraElevation += (deltaY * ROTATION_SENSITIVITY);
      cameraElevation = Math.min(MAX_CAMERA_ELEVATION, Math.max(MIN_CAMERA_ELEVATION, cameraElevation));
      updateCameraPosition();
    }
    // Handles the panning of the camera
    if (isMiddleMouseDown) {
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(Y_AXIS, cameraAzimuth * DEG2RAD);
      const left = new THREE.Vector3(1, 0, 0).applyAxisAngle(Y_AXIS, cameraAzimuth * DEG2RAD);
      cameraOrigin.add(forward.multiplyScalar(PAN_SENSITIVITY * deltaY));
      cameraOrigin.add(left.multiplyScalar(PAN_SENSITIVITY * deltaX));
      updateCameraPosition();
    }
    // Handles the zoom of the camera
    if (isRightMouseDown) {
      cameraRadius += deltaY * ZOOM_SENSITIVITY;
      cameraRadius = Math.min(MAX_CAMERA_RADIUS, Math.max(MIN_CAMERA_RADIUS, cameraRadius));
      updateCameraPosition();
    }
    prevMouseX = event.clientX;
    prevMouseY = event.clientY;
  }
  function updateCameraPosition() {
    camera.position.x = cameraRadius * Math.sin(cameraAzimuth * DEG2RAD) * Math.cos(cameraElevation * DEG2RAD);
    camera.position.y = cameraRadius * Math.sin(cameraElevation * DEG2RAD);
    camera.position.z = cameraRadius * Math.cos(cameraAzimuth * DEG2RAD) * Math.cos(cameraElevation * DEG2RAD);
    camera.position.add(cameraOrigin);
    camera.lookAt(cameraOrigin);
    camera.updateMatrix();
  }

  function earthquake(duration = 3, intensity = 0.1) {
    const startTime = performance.now();
    const originalPosition = camera.position.clone();

    function shake() {
      const elapsedTime = (performance.now() - startTime) / 1000;

      if (elapsedTime < duration) {
        // Generate random offsets
        const offsetX = (Math.random() - 0.5) * intensity;
        const offsetY = (Math.random() - 0.5) * intensity;
        const offsetZ = (Math.random() - 0.5) * intensity;

        // Apply offsets to the camera position
        camera.position.set(
          originalPosition.x + offsetX,
          originalPosition.y + offsetY,
          originalPosition.z + offsetZ
        );
        camera.lookAt(cameraOrigin);

        // Continue shaking
        requestAnimationFrame(shake);
      } else {
        // Reset camera position after the earthquake
        camera.position.copy(originalPosition);
        camera.lookAt(cameraOrigin);
      }
    }

    shake();
  }
  return {
    camera,
    onMouseDown,
    onMouseUp,
    onMouseMove,
    earthquake,
    updateCameraPosition,
    get cameraAzimuth() { return cameraAzimuth; },
    set cameraAzimuth(val) { cameraAzimuth = val; },
    get cameraElevation() { return cameraElevation; },
    set cameraElevation(val) { cameraElevation = val; },
    get cameraRadius() { return cameraRadius; },
    set cameraRadius(val) { cameraRadius = val; },
    get cameraOrigin() { return cameraOrigin; },
    set cameraOrigin(val) { cameraOrigin = val; },
    
    
  }
}
