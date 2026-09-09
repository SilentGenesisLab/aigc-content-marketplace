"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function TechScene({ variant = "hero" }: { variant?: "hero" | "auth" }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 0, variant === "auth" ? 7.2 : 6.3);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(variant === "auth" ? 1.38 : 1.05, 2),
      new THREE.MeshBasicMaterial({ color: 0x5ee7ff, wireframe: true, transparent: true, opacity: 0.26 }),
    );
    group.add(core);

    const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x6c63ff, wireframe: true, transparent: true, opacity: 0.4 });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(variant === "auth" ? 2.05 : 1.6, 0.025, 8, 96), haloMaterial);
    halo.rotation.set(1.08, 0.18, 0.28);
    group.add(halo);

    const secondHalo = halo.clone();
    secondHalo.scale.setScalar(0.78);
    secondHalo.rotation.set(0.35, 1.1, 0.1);
    group.add(secondHalo);

    const count = variant === "auth" ? 150 : 96;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = 2.2 + Math.random() * (variant === "auth" ? 2.5 : 1.8);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[index * 3 + 2] = radius * Math.cos(phi);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: 0x7ddcff, size: variant === "auth" ? 0.038 : 0.045, transparent: true, opacity: 0.72 }),
    );
    group.add(particles);

    const pointer = new THREE.Vector2();
    const onPointerMove = (event: PointerEvent) => {
      const bounds = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    };
    mount.addEventListener("pointermove", onPointerMove, { passive: true });

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motionQuery.matches;
    const onMotionChange = (event: MediaQueryListEvent) => { reduceMotion = event.matches; };
    motionQuery.addEventListener("change", onMotionChange);

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const timer = new THREE.Timer();
    timer.connect(document);
    let frame = 0;
    const render = (timestamp?: number) => {
      timer.update(timestamp);
      const elapsed = timer.getElapsed();
      if (!reduceMotion) {
        group.rotation.y += (pointer.x * 0.16 - group.rotation.y) * 0.025;
        group.rotation.x += (-pointer.y * 0.1 - group.rotation.x) * 0.025;
        core.rotation.y = elapsed * 0.12;
        core.rotation.x = elapsed * 0.08;
        halo.rotation.z = 0.28 + elapsed * 0.08;
        secondHalo.rotation.z = 0.1 - elapsed * 0.11;
        particles.rotation.y = -elapsed * 0.018;
      }
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      mount.removeEventListener("pointermove", onPointerMove);
      particleGeometry.dispose();
      (particles.material as THREE.Material).dispose();
      core.geometry.dispose();
      (core.material as THREE.Material).dispose();
      halo.geometry.dispose();
      haloMaterial.dispose();
      timer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);

  return <div className={`tech-scene tech-scene-${variant}`} ref={mountRef} aria-hidden="true" />;
}
