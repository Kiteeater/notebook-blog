"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { sceneState } from "@/lib/sceneState";
import { fragmentShader, vertexShader } from "./sceneShader";

/**
 * 跨路由常驻的共享场景。挂载在根布局，永不卸载。
 * 每帧从 sceneState 读取 GSAP 正在改写的数值，灌入 shader uniform。
 */
export default function SceneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      sceneState.webgl = false;
      setFailed(true);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uScroll: { value: 0 },
      uExposure: { value: sceneState.exposure },
      uContrast: { value: sceneState.contrast },
      uFogLift: { value: sceneState.fogLift },
      uLiquify: { value: sceneState.liquify },
      uDrift: { value: sceneState.drift },
      uSubmerge: { value: sceneState.submerge },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w * dpr, h * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      sceneState.mouseTX = (e.clientX / window.innerWidth) * 2 - 1;
      sceneState.mouseTY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      if (document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);

      if (!sceneState.reduced) {
        sceneState.time += dt;
        // 滚轮冲量缓慢衰减，只推动镜头
        sceneState.wheelImpulse *= 0.94;
      }
      const k = sceneState.reduced ? 1 : 1 - Math.pow(0.001, dt); // 帧率无关缓动
      sceneState.mouseX += (sceneState.mouseTX - sceneState.mouseX) * k * 0.4;
      sceneState.mouseY += (sceneState.mouseTY - sceneState.mouseY) * k * 0.4;
      sceneState.scroll +=
        (sceneState.scrollTarget + sceneState.wheelImpulse - sceneState.scroll) *
        k *
        0.25;

      uniforms.uTime.value = sceneState.time;
      uniforms.uMouse.value.set(
        sceneState.reduced ? 0 : sceneState.mouseX,
        sceneState.reduced ? 0 : sceneState.mouseY,
      );
      uniforms.uScroll.value = sceneState.scroll;
      uniforms.uExposure.value = sceneState.exposure;
      uniforms.uContrast.value = sceneState.contrast;
      uniforms.uFogLift.value = sceneState.fogLift;
      uniforms.uLiquify.value = sceneState.liquify;
      uniforms.uDrift.value = sceneState.reduced ? 0 : sceneState.drift;
      uniforms.uSubmerge.value = sceneState.reduced ? 0 : sceneState.submerge;

      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      quad.geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  if (failed) return <SceneFallback />;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 0 }}
    />
  );
}

/** 无 WebGL 降级：固定层叠渐变 + 缓慢材质光泽，仍属于同一个空间 */
function SceneFallback() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #c4bcb0 0%, #e6dfd2 34%, #efe9dc 55%, #d9d2c2 100%)",
        }}
      />
      {/* 碑板剪影 */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "linear-gradient(90deg, transparent 6%, #a89e8c 6.5%, #a89e8c 12%, transparent 12.5%, transparent 30%, #b3a996 30.5%, #b3a996 38%, transparent 38.5%, transparent 66%, #a89e8c 66.5%, #a89e8c 71%, transparent 71.5%)",
          maskImage: "linear-gradient(180deg, black 55%, transparent 56%)",
          WebkitMaskImage: "linear-gradient(180deg, black 55%, transparent 56%)",
        }}
      />
      {/* 地面光泽 */}
      <div
        className="absolute inset-x-0 bottom-0 h-[45%]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,252,244,0.75), rgba(168,180,194,0.28) 45%, rgba(120,110,95,0.32))",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 22% 12%, rgba(255,250,238,0.5), transparent 70%)",
        }}
      />
    </div>
  );
}
