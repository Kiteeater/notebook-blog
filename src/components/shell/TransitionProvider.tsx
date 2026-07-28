"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { SCENE_PRESETS, DIVE_PEAK, modeForPath, sceneState } from "@/lib/sceneState";

if (typeof window !== "undefined") {
  gsap.registerPlugin(CustomEase);
  CustomEase.create("observatory", "M0,0 C0.22,1 0.36,1 1,1");
  // 下潜：先在水面滞留，再加速没入 —— 强 ease-in，末段斜率与 power2.in 相近
  CustomEase.create("dive", "M0,0 C0.66,0 0.8,0.46 1,1");
}

type TransitionContextValue = {
  navigate: (href: string) => void;
  prefetch: (href: string) => void;
  transitioning: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
};

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function useTransition() {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error("useTransition must be used inside TransitionProvider");
  return ctx;
}

const EASE = "observatory";
/** 没入水面、切换路由的时刻（此时遮罩达到峰值） */
const DIVE_CUT = 0.62;

export default function TransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [transitioning, setTransitioning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /** 控制器发起的导航：pathname 变化后需要走「分层入场」 */
  const pendingRef = useRef<string | null>(null);
  /** 浏览器前进/后退标记 */
  const popRef = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // reduced-motion 写入共享状态
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      sceneState.reduced = mq.matches;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const lock = useCallback(() => {
    setTransitioning(true);
    document.documentElement.classList.add("is-transitioning");
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    // 安全锁：2.6s 后无论如何恢复交互；若路由始终未落地，放弃下潜并归位
    unlockTimer.current = setTimeout(() => {
      if (pendingRef.current) {
        pendingRef.current = null;
        const preset = SCENE_PRESETS[modeForPath(window.location.pathname)];
        gsap.killTweensOf(sceneState);
        gsap.to(sceneState, { ...preset, duration: 0.6, ease: "sine.out" });
        const root = document.querySelector<HTMLElement>("[data-page]");
        if (root) {
          gsap.to(root, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: "sine.out" });
          gsap.to(root.querySelectorAll("[data-exit-first]"), {
            autoAlpha: 1,
            y: 0,
            duration: 0.4,
            ease: "sine.out",
          });
        }
      }
      setTransitioning(false);
      document.documentElement.classList.remove("is-transitioning");
    }, 2600);
  }, []);

  const unlock = useCallback(() => {
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    setTransitioning(false);
    document.documentElement.classList.remove("is-transitioning");
  }, []);

  /** 新内容分层入场：标题 → 筛选器 → 网格，逐级延迟 */
  const runEnter = useCallback(
    (staggered: boolean) => {
      const root = document.querySelector<HTMLElement>("[data-page]");
      if (!root) {
        unlock();
        return;
      }
      const els = root.querySelectorAll<HTMLElement>("[data-enter]");
      if (!els.length || sceneState.reduced) {
        els.forEach((el) => {
          el.style.animation = "none";
          el.style.opacity = "1";
        });
        unlock();
        return;
      }
      els.forEach((el) => {
        el.style.animation = "none"; // 关闭 CSS 保底动画，交给 GSAP
      });
      // 水下着陆：新内容从更深处浮起，阻尼更长
      gsap.set(els, { autoAlpha: 0, y: staggered ? 36 : 14 });
      gsap.to(els, {
        autoAlpha: 1,
        y: 0,
        duration: staggered ? 1.15 : 0.55,
        ease: EASE,
        stagger: staggered ? 0.08 : 0.04,
        delay: staggered ? 0.12 : 0,
        onComplete: () => {
          // 清掉入场残留在 [data-enter]（如 .post-item）上的 transform，
          // 让透视与浮力（作用于内层 .buoyant）干净生效；不动 autoAlpha 的 opacity/visibility
          gsap.set(els, { clearProps: "transform" });
          unlock();
        },
      });
    },
    [unlock],
  );

  // pathname 变化：决定走哪种入场
  useEffect(() => {
    const mode = modeForPath(pathname);
    const preset = SCENE_PRESETS[mode];

    if (pendingRef.current) {
      // 控制器主导：入水段已在峰值附近切页，这里负责「着陆」与收尾
      pendingRef.current = null;
      gsap.killTweensOf(sceneState); // 停掉入水段残余 tween，避免与着陆段互相拉扯

      const { liquify, scrollTarget, ...look } = preset;
      const still = sceneState.reduced;
      const tl = gsap.timeline();

      // 1. 水体退散：曝光 / 对比 / 雾 / submerge 缓缓归位
      tl.to(sceneState, { ...look, duration: still ? 0 : 1.35, ease: "sine.inOut" }, 0);
      if (still) {
        tl.set(sceneState, { liquify, scrollTarget }, 0);
      } else {
        // 2. 波纹越过平静点再回稳 —— 水波余韵
        tl.to(
          sceneState,
          { liquify: Math.max(liquify - 0.07, 0), duration: 0.8, ease: "power2.out" },
          0,
        );
        tl.to(sceneState, { liquify, duration: 0.9, ease: "sine.inOut" }, 0.8);
        // 3. 浮力回弹：世界轻微回沉后归位
        tl.to(
          sceneState,
          { scrollTarget: scrollTarget + 0.03, duration: 0.95, ease: "power2.out" },
          0.05,
        );
        tl.to(sceneState, { scrollTarget, duration: 0.9, ease: "sine.inOut" }, 1.0);
      }

      // 等新 DOM 绘制一帧再入场
      requestAnimationFrame(() => requestAnimationFrame(() => runEnter(true)));
      return;
    }

    if (popRef.current) {
      // 前进/后退：简化转场
      popRef.current = false;
      gsap.to(sceneState, {
        ...preset,
        liquify: Math.max(preset.liquify, 0.3),
        duration: sceneState.reduced ? 0 : 0.5,
        ease: "power2.out",
        onComplete: () => {
          gsap.to(sceneState, {
            liquify: preset.liquify,
            duration: 0.6,
            ease: EASE,
          });
        },
      });
      runEnter(false);
      return;
    }

    // 直接访问 / 刷新：场景立即归位，内容走 CSS 保底入场
    Object.assign(sceneState, preset);
  }, [pathname, runEnter]);

  // popstate 标记
  useEffect(() => {
    const onPop = () => {
      popRef.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      if (transitioning || href === pathname) return;
      setMenuOpen(false);

      const targetMode = modeForPath(href);
      const preset = SCENE_PRESETS[targetMode];

      if (sceneState.reduced) {
        // reduced-motion：不做液态转场，直接导航
        router.push(href);
        return;
      }

      lock();
      pendingRef.current = href;

      const currentRoot = document.querySelector<HTMLElement>("[data-page]");

      /* 「沉到水底」三段编舞：入水 → 没入 →（切页后由 pathname 效应负责着陆） */
      const tl = gsap.timeline();
      // 1. 入水：CTA / 前景先向上消散
      if (currentRoot) {
        tl.to(
          currentRoot.querySelectorAll("[data-exit-first]"),
          { autoAlpha: 0, y: -16, duration: 0.32, ease: "power2.in" },
          0,
        );
        // 2. 整页向上远去（我们在向下沉），务必在切页前完成
        tl.to(
          currentRoot,
          { autoAlpha: 0, y: -48, scale: 0.985, duration: 0.5, ease: "power2.in" },
          0.1,
        );
      }
      // 3. 下潜：世界向上掠过（scrollTarget 转负），先在水面滞留再加速沉下
      tl.to(
        sceneState,
        { scrollTarget: -0.2, duration: 0.74, ease: "dive" },
        0.05,
      );
      // 4. 波纹增强：随下潜同步加剧，水在加速段被搅起
      tl.to(sceneState, { liquify: DIVE_PEAK.liquify, duration: 0.7, ease: "dive" }, 0.08);
      // 5. 没入：水面光在切页瞬间达到峰值，恰好遮住切换；submerge 期间
      //    光柱与气泡持续游动，即使新路由尚未就绪也不会僵住。
      //    与旧逻辑相反——真实下潜是「变暗变冷变窄」而非「变亮变白」：
      //    暗曝光 + 重雾 + 视野收窄，配合 shader 冷调与暗角模拟深水压迫感。
      tl.to(
        sceneState,
        {
          submerge: DIVE_PEAK.submerge,
          exposure: DIVE_PEAK.exposure,
          contrast: DIVE_PEAK.contrast,
          fogLift: DIVE_PEAK.fogLift,
          vignette: DIVE_PEAK.vignette,
          duration: 0.6,
          ease: "sine.in",
        },
        0.12,
      );
      // 6. 峰值处切换路由（旧页面已完全淡出，新页面在水光中进入）
      tl.add(() => router.push(href), DIVE_CUT);
    },
    [transitioning, pathname, router, lock],
  );

  const prefetch = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router],
  );

  return (
    <TransitionContext.Provider
      value={{ navigate, prefetch, transitioning, menuOpen, setMenuOpen }}
    >
      {children}
    </TransitionContext.Provider>
  );
}
