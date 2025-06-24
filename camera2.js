import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.module.js';

export function createCamera(container) {
  const DEG2RAD = Math.PI / 180.0;
  const LEFT_MOUSE_BUTTON = 0;
  const MIDDLE_MOUSE_BUTTON = 1;
  const RIGHT_MOUSE_BUTTON = 2;
  const MIN_CAMERA_RADIUS = 2;
  const MAX_CAMERA_RADIUS = 50;
  const MIN_CAMERA_ELEVATION = 10;
  const MAX_CAMERA_ELEVATION = 89;
  const ROTATION_SENSITIVITY = 0.5;
  const ZOOM_SENSITIVITY = 0.05;
  const PAN_SENSITIVITY = -0.01;
  const Y_AXIS = new THREE.Vector3(0, 1, 0);

  const camera = new THREE.PerspectiveCamera(
    75, 
    container.clientWidth / container.clientHeight, 
    0.1, 
    1000
  );

  let cameraOrigin = new THREE.Vector3(0, 2, 0);
  let cameraRadius = 15;
  let cameraAzimuth = 45;   // degrees
  let cameraElevation = 45; // degrees

  let isLeftMouseDown = false;
  let isMiddleMouseDown = false;
  let isRightMouseDown = false;
  let prevMouseX = 0;
  let prevMouseY = 0;

  function updateCameraPosition() {
    // Spherical to Cartesian
    const azimuthRad = cameraAzimuth * DEG2RAD;
    const elevationRad = cameraElevation * DEG2RAD;

    camera.position.x = cameraRadius * Math.sin(azimuthRad) * Math.cos(elevationRad);
    camera.position.y = cameraRadius * Math.sin(elevationRad);
    camera.position.z = cameraRadius * Math.cos(azimuthRad) * Math.cos(elevationRad);

    camera.position.add(cameraOrigin);
    camera.lookAt(cameraOrigin);
    camera.updateMatrix();
  }

  function onMouseDown(event) {
    if (event.button === LEFT_MOUSE_BUTTON) isLeftMouseDown = true;
    if (event.button === MIDDLE_MOUSE_BUTTON) isMiddleMouseDown = true;
    if (event.button === RIGHT_MOUSE_BUTTON) isRightMouseDown = true;
    prevMouseX = event.clientX;
    prevMouseY = event.clientY;
  }

  function onMouseUp(event) {
    if (event.button === LEFT_MOUSE_BUTTON) isLeftMouseDown = false;
    if (event.button === MIDDLE_MOUSE_BUTTON) isMiddleMouseDown = false;
    if (event.button === RIGHT_MOUSE_BUTTON) isRightMouseDown = false;
  }

  function onMouseMove(event) {
    const deltaX = event.clientX - prevMouseX;
    const deltaY = event.clientY - prevMouseY;

    if (isLeftMouseDown) {
      cameraAzimuth -= deltaX * ROTATION_SENSITIVITY;
      cameraElevation += deltaY * ROTATION_SENSITIVITY;
      cameraElevation = Math.min(MAX_CAMERA_ELEVATION, Math.max(MIN_CAMERA_ELEVATION, cameraElevation));
      updateCameraPosition();
    }

    if (isMiddleMouseDown) {
      // Pan: move cameraOrigin along camera left and forward vectors
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, cameraAzimuth * DEG2RAD);
      const left = new THREE.Vector3().crossVectors(Y_AXIS, forward).normalize();
      cameraOrigin.add(forward.multiplyScalar(PAN_SENSITIVITY * deltaY));
      cameraOrigin.add(left.multiplyScalar(PAN_SENSITIVITY * deltaX));
      updateCameraPosition();
    }

    if (isRightMouseDown) {
      cameraRadius += deltaY * ZOOM_SENSITIVITY;
      cameraRadius = Math.min(MAX_CAMERA_RADIUS, Math.max(MIN_CAMERA_RADIUS, cameraRadius));
      updateCameraPosition();
    }

    prevMouseX = event.clientX;
    prevMouseY = event.clientY;
  }

  function onWheel(event) {
    cameraRadius += event.deltaY * 0.01;
    cameraRadius = Math.min(MAX_CAMERA_RADIUS, Math.max(MIN_CAMERA_RADIUS, cameraRadius));
    updateCameraPosition();
  }

  // Initialize position
  updateCameraPosition();

  return {
    camera,
    onMouseDown,
    onMouseUp,
    onMouseMove,
    onWheel,

    updateCameraPosition,
  get cameraAzimuth() { return cameraAzimuth; },
  set cameraAzimuth(val) { cameraAzimuth = val; },
  get cameraElevation() { return cameraElevation; },
  set cameraElevation(val) { cameraElevation = val; },
  get cameraRadius() { return cameraRadius; },
  set cameraRadius(val) { cameraRadius = val; },
  get cameraOrigin() { return cameraOrigin; },
  set cameraOrigin(val) { cameraOrigin = val; },

  };
}
