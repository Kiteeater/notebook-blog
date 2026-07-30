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
import {
  SCENE_PRESETS,
  DIVE_PEAK,
  EMERGE_PEAK,
  modeForPath,
  sceneState,
  type SceneMode,
} from "@/lib/sceneState";

if (typeof window !== "undefined") {
  gsap.registerPlugin(CustomEase);
  CustomEase.create("observatory", "M0,0 C0.22,1 0.36,1 1,1");
  // 下潜：先在水面滞留，再加速没入 —— 强 ease-in
  CustomEase.create("dive", "M0,0 C0.66,0 0.8,0.46 1,1");
  // 破水：先蓄力上浮，末段加速穿出水面
  CustomEase.create("breach", "M0,0 C0.4,0 0.55,0.35 1,1");
}

type TransitionKind = "dive" | "emerge" | "soft";

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
/** 没入水面 / 破水瞬间切换路由的时刻（遮罩达到峰值） */
const CUT = 0.62;

/**
 * writing → article：破水而出
 * article → article：干燥软切（上一篇/下一篇，保持阳光，不重回水下）
 * 其余：下潜
 */
function kindFor(from: SceneMode, to: SceneMode): TransitionKind {
  if (from === "writing" && to === "article") return "emerge";
  if (from === "article" && to === "article") return "soft";
  return "dive";
}

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
  /** 当前转场类型（着陆段读） */
  const kindRef = useRef<TransitionKind>("dive");
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
    // 安全锁：2.6s 后无论如何恢复交互；若路由始终未落地，放弃转场并归位
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

  /**
   * 新内容分层入场。
   * emerge：从水下被拉起 —— 起点更低、时长更长、带轻微 scale 回弹。
   * dive：从深处浮起（既有语义）。
   */
  const runEnter = useCallback(
    (staggered: boolean, kind: TransitionKind = "dive") => {
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

      const emerge = kind === "emerge" && staggered;
      // 破水：从更深处被拽出；下潜着陆：从略深处浮起
      gsap.set(els, {
        autoAlpha: 0,
        y: emerge ? 56 : staggered ? 36 : 14,
        scale: emerge ? 0.97 : 1,
        filter: emerge ? "blur(4px)" : "none",
      });
      gsap.to(els, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: emerge ? 1.35 : staggered ? 1.15 : 0.55,
        ease: EASE,
        stagger: emerge ? 0.09 : staggered ? 0.08 : 0.04,
        delay: staggered ? 0.1 : 0,
        onComplete: () => {
          // 清掉入场残留 transform / filter，让后续 3D 倾斜等干净生效
          gsap.set(els, { clearProps: "transform,filter" });
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
      // 控制器主导：入水/破水段已在峰值附近切页，这里负责「着陆」与收尾
      pendingRef.current = null;
      gsap.killTweensOf(sceneState); // 停掉入水段残余 tween，避免与着陆段互相拉扯

      const kind = kindRef.current;
      const { liquify, scrollTarget, ...look } = preset;
      const still = sceneState.reduced;
      const tl = gsap.timeline();

      if (kind === "emerge") {
        // —— 破水着陆：水体退尽、阳光接管、镜头落稳 ——
        tl.to(sceneState, { ...look, duration: still ? 0 : 1.5, ease: "sine.inOut" }, 0);
        if (still) {
          tl.set(sceneState, { liquify, scrollTarget }, 0);
        } else {
          // 水面余波：liquify 越过平静点再归零（水珠滑落）
          tl.to(
            sceneState,
            { liquify: Math.max(liquify, 0.12), duration: 0.55, ease: "power2.out" },
            0,
          );
          tl.to(sceneState, { liquify: 0, duration: 1.05, ease: "sine.inOut" }, 0.55);
          // 上浮惯性：镜头先略抬再回落
          tl.to(
            sceneState,
            { scrollTarget: scrollTarget + 0.025, duration: 0.7, ease: "power2.out" },
            0.05,
          );
          tl.to(sceneState, { scrollTarget, duration: 1.0, ease: "sine.inOut" }, 0.75);
        }
      } else if (kind === "soft") {
        // —— 干燥软切着陆：始终无水，只回稳 warmth/曝光 ——
        tl.to(sceneState, { ...look, liquify: 0, scrollTarget, duration: still ? 0 : 0.7, ease: "sine.out" }, 0);
      } else {
        // —— 下潜着陆（既有语义） ——
        tl.to(sceneState, { ...look, duration: still ? 0 : 1.35, ease: "sine.inOut" }, 0);
        if (still) {
          tl.set(sceneState, { liquify, scrollTarget }, 0);
        } else {
          tl.to(
            sceneState,
            { liquify: Math.max(liquify - 0.07, 0), duration: 0.8, ease: "power2.out" },
            0,
          );
          tl.to(sceneState, { liquify, duration: 0.9, ease: "sine.inOut" }, 0.8);
          tl.to(
            sceneState,
            { scrollTarget: scrollTarget + 0.03, duration: 0.95, ease: "power2.out" },
            0.05,
          );
          tl.to(sceneState, { scrollTarget, duration: 0.9, ease: "sine.inOut" }, 1.0);
        }
      }

      // 等新 DOM 绘制一帧再入场
      requestAnimationFrame(() =>
        requestAnimationFrame(() => runEnter(true, kind === "soft" ? "dive" : kind)),
      );
      return;
    }

    if (popRef.current) {
      // 前进/后退：简化转场（按目标页模式选余波强度）
      popRef.current = false;
      const popKind: TransitionKind = mode === "article" ? "emerge" : "dive";
      gsap.to(sceneState, {
        ...preset,
        liquify: Math.max(preset.liquify, popKind === "emerge" ? 0 : 0.3),
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
      runEnter(false, popKind);
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

      const fromMode = modeForPath(pathname);
      const targetMode = modeForPath(href);
      const kind = kindFor(fromMode, targetMode);
      kindRef.current = kind;

      if (sceneState.reduced) {
        // reduced-motion：不做液态/破水转场，直接导航
        router.push(href);
        return;
      }

      lock();
      pendingRef.current = href;

      const currentRoot = document.querySelector<HTMLElement>("[data-page]");
      const tl = gsap.timeline();

      if (kind === "emerge") {
        /* 「破水而出」：蓄力上浮 → 穿出水面 →（切页后着陆） */
        if (currentRoot) {
          tl.to(
            currentRoot.querySelectorAll("[data-exit-first]"),
            { autoAlpha: 0, y: -28, duration: 0.34, ease: "power2.in" },
            0,
          );
          // 整页向上抬升并略放大（文章被拽出），同时淡出
          tl.to(
            currentRoot,
            {
              autoAlpha: 0,
              y: -72,
              scale: 1.02,
              duration: 0.55,
              ease: "power2.in",
            },
            0.08,
          );
        }
        // 镜头上抬：从水下朝水面
        tl.to(
          sceneState,
          { scrollTarget: 0.12, duration: 0.72, ease: "breach" },
          0.04,
        );
        // 水面张力撕裂
        tl.to(
          sceneState,
          { liquify: EMERGE_PEAK.liquify, duration: 0.55, ease: "breach" },
          0.1,
        );
        // 水体抽离 + 阳光灌入
        tl.to(
          sceneState,
          {
            submerge: EMERGE_PEAK.submerge,
            exposure: EMERGE_PEAK.exposure,
            contrast: EMERGE_PEAK.contrast,
            fogLift: EMERGE_PEAK.fogLift,
            vignette: EMERGE_PEAK.vignette,
            warmth: EMERGE_PEAK.warmth,
            duration: 0.58,
            ease: "sine.in",
          },
          0.14,
        );
        tl.add(() => router.push(href), CUT);
      } else if (kind === "soft") {
        /* 干燥软切：上一篇/下一篇，不回水下 */
        const articleLook = SCENE_PRESETS.article;
        if (currentRoot) {
          tl.to(
            currentRoot,
            { autoAlpha: 0, y: -20, duration: 0.38, ease: "power2.in" },
            0,
          );
        }
        // 阳光略闪一下（曝光微抬），全程 liquify/submerge 保持干燥
        tl.to(
          sceneState,
          {
            exposure: articleLook.exposure + 0.12,
            warmth: Math.min(1, articleLook.warmth + 0.1),
            liquify: 0,
            submerge: 0,
            duration: 0.4,
            ease: "sine.inOut",
          },
          0,
        );
        tl.add(() => router.push(href), 0.42);
      } else {
        /* 「沉到水底」 */
        if (currentRoot) {
          tl.to(
            currentRoot.querySelectorAll("[data-exit-first]"),
            { autoAlpha: 0, y: -16, duration: 0.32, ease: "power2.in" },
            0,
          );
          tl.to(
            currentRoot,
            { autoAlpha: 0, y: -48, scale: 0.985, duration: 0.5, ease: "power2.in" },
            0.1,
          );
        }
        tl.to(
          sceneState,
          { scrollTarget: -0.2, duration: 0.74, ease: "dive" },
          0.05,
        );
        tl.to(sceneState, { liquify: DIVE_PEAK.liquify, duration: 0.7, ease: "dive" }, 0.08);
        tl.to(
          sceneState,
          {
            submerge: DIVE_PEAK.submerge,
            exposure: DIVE_PEAK.exposure,
            contrast: DIVE_PEAK.contrast,
            fogLift: DIVE_PEAK.fogLift,
            vignette: DIVE_PEAK.vignette,
            warmth: DIVE_PEAK.warmth,
            duration: 0.6,
            ease: "sine.in",
          },
          0.12,
        );
        tl.add(() => router.push(href), CUT);
      }
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
