"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  getNodesBounds,
  useReactFlow,
  useStore,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { GenerationLabelNode } from "@/components/GenerationLabelNode";
import { JunctionNode } from "@/components/JunctionNode";
import { BotanicalCollapsedBranch } from "@/components/family/BotanicalCollapsedBranch";
import { AssetTreeLayer } from "@/components/family/AssetTreeLayer";
import { TreeFruitPersonNode } from "@/components/family/TreeFruitPersonNode";
import { TreeDebugOverlay, useTreeDebugEnabled } from "@/components/family/TreeDebugOverlay";
import { SoftBranchOverlay } from "@/components/family/SoftBranchOverlay";
import { TreeCenterHint } from "@/components/family/TreeCenterHint";
import { HeritageTreeBackdrop } from "@/components/family/HeritageTreeBackdrop";
import { DiagramCanvasBackdrop } from "@/components/family/DiagramCanvasBackdrop";
import { DisconnectedPeoplePanel } from "@/components/family/DisconnectedPeoplePanel";
import { PersonNode } from "@/components/PersonNode";
import { RelationshipLegend } from "@/components/RelationshipLegend";
import { TreeToolbar } from "@/components/TreeToolbar";
import { UnionNode } from "@/components/UnionNode";
import { buildFocusedFamilyLayout } from "@/lib/focused-family-layout";
import { buildFocusedFamilyModel } from "@/lib/focused-family-model";
import {
  computeTreeIllustrationBounds,
  heritageHeightFill,
  heritageWidthRatio,
} from "@/lib/tree-asset-bounds";
import {
  boundsCenter,
  computeCameraZoom,
  computeDiagramViewBoundsSet,
  computeTreeViewBoundsSet,
} from "@/lib/tree-view-bounds";
import {
  BOTANICAL_ALL_MIN_ZOOM,
  BOTANICAL_BRANCH_MIN_ZOOM,
  BOTANICAL_CENTER_ZOOM,
  BOTANICAL_GENERATIONS_MIN_ZOOM,
  BOTANICAL_NEARBY_MIN_ZOOM,
  BOTANICAL_NODE_HEIGHT,
  BOTANICAL_NODE_WIDTH,
  resolveBotanicalDetailLevel,
  type BotanicalDetailLevel,
} from "@/lib/botanical-tree-theme";
import { getFocusedFamilyPersonIds } from "@/lib/tree-highlight";
import type { TreeVisualMode } from "@/lib/heritage-theme";
import {
  BRANCH_ZOOM,
  COMPACT_ZOOM_THRESHOLD,
  DEFAULT_LAYOUT_SPACING,
  DIAGRAM_ALL_FIT_MIN_ZOOM,
  DIAGRAM_ALL_MIN_ZOOM,
  DIAGRAM_NODE_SIZE,
  EDGE_STROKE,
  EDGE_STROKE_WIDTH,
  FIT_MAX_ZOOM,
  FIT_MIN_ZOOM,
  FOCUS_ZOOM,
  GENERATIONS_ZOOM,
  NEARBY_ZOOM,
  NODE_HEIGHT,
  NODE_WIDTH,
  SEARCH_ZOOM_MAX,
  SEARCH_ZOOM_MIN,
  applyNodeData,
  buildLayoutedGraph,
  getRelatedPersonIds,
  isEdgeRelatedToPerson,
  type LayoutSpacing,
} from "@/lib/tree-layout";
import {
  buildFamilyViewPersonIds,
  getFamilyViewModeCounts,
} from "@/lib/family-view-visibility";
import {
  buildPersonIndex,
  filterPeopleByIds,
  getHiddenDescendantCount,
  getVisiblePersonIds,
  personHasCollapsibleDescendants,
  type TreeViewMode,
} from "@/lib/tree-visibility";
import {
  resolvePersonPhotoUrl,
  usePersonPhotoUrls,
} from "@/hooks/usePersonPhotoUrls";
import type { Person, PersonNodeData } from "@/types/family";

type TreeNode = Node;
type TreeInstance = ReactFlowInstance;

const diagramNodeTypes = {
  person: PersonNode,
  junction: JunctionNode,
  union: UnionNode,
  generationLabel: GenerationLabelNode,
};

const heritageNodeTypes = {
  person: TreeFruitPersonNode,
  botanicalCollapsed: BotanicalCollapsedBranch,
};

const MINIMAP_THRESHOLD = 10;

export interface FamilyTreeHandle {
  focusPerson: (personId: string, options?: { search?: boolean }) => void;
  fitView: () => void;
  focusCurrentUser: () => void;
}

interface FamilyTreeProps {
  people: Person[];
  currentUserId: string;
  focusedPersonId: string | null;
  selectedPersonId: string | null;
  viewMode: TreeViewMode;
  collapsedPersonIds: ReadonlySet<string>;
  searchFlashPersonId: string | null;
  focusLabel: string | null;
  focusLabelShort: string | null;
  visualMode: TreeVisualMode;
  onVisualModeChange: (mode: TreeVisualMode) => void;
  onSelectPerson: (personId: string) => void;
  onMakeCenter?: (personId: string) => void;
  onModeActivate: (mode: TreeViewMode) => void;
  onToggleCollapse: (personId: string) => void;
  onExpandAll: () => void;
  isTreeOnly: boolean;
  onToggleTreeOnly: () => void;
}

const FamilyTreeCanvas = forwardRef<FamilyTreeHandle, FamilyTreeProps>(
  function FamilyTreeCanvas(
    {
      people,
      currentUserId,
      focusedPersonId,
      selectedPersonId,
      viewMode,
      collapsedPersonIds,
      searchFlashPersonId,
      focusLabel,
      focusLabelShort,
      visualMode,
      onVisualModeChange,
      onSelectPerson,
      onMakeCenter,
      onModeActivate,
      onToggleCollapse,
      onExpandAll,
      isTreeOnly,
      onToggleTreeOnly,
    },
    ref,
  ) {
    const reactFlow = useReactFlow();
    const zoom = useStore((state) => state.transform[2]);
    const containerRef = useRef<HTMLDivElement>(null);
    const flowInstanceRef = useRef<TreeInstance | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(1200);
    const [miniMapVisible, setMiniMapVisible] = useState(true);
    const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null);
    const [detailLevel, setDetailLevel] = useState<BotanicalDetailLevel>("full");
    const [expandedCollateralIds, setExpandedCollateralIds] = useState<
      Set<string>
    >(() => new Set());
    const [includeDetachedOnCanvas, setIncludeDetachedOnCanvas] = useState(false);
    const [pinnedDetachedFocusIds, setPinnedDetachedFocusIds] = useState<
      Set<string>
    >(() => new Set());
    const detailTimerRef = useRef<number | null>(null);
    const hasInitializedView = useRef(false);
    const cameraResetKeyRef = useRef("");
    const [viewReady, setViewReady] = useState(false);
    const isCompact = viewReady && zoom < COMPACT_ZOOM_THRESHOLD;
    const centerTokenRef = useRef(0);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const updateWidth = () => setViewportWidth(container.clientWidth || 1200);
      updateWidth();
      const observer = new ResizeObserver(updateWidth);
      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      const mediaQuery = window.matchMedia("(max-width: 767px)");
      const update = () => {
        const mobile = mediaQuery.matches;
        setIsMobile(mobile);
        setMiniMapVisible(!mobile);
      };
      update();
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }, []);

    useEffect(() => {
      if (visualMode !== "heritage") {
        setDetailLevel("full");
        return;
      }
      if (detailTimerRef.current !== null) {
        window.clearTimeout(detailTimerRef.current);
      }
      detailTimerRef.current = window.setTimeout(() => {
        if (visualMode === "heritage") {
          setDetailLevel(resolveBotanicalDetailLevel(zoom, viewMode));
        } else {
          setDetailLevel("full");
        }
      }, 80);
      return () => {
        if (detailTimerRef.current !== null) {
          window.clearTimeout(detailTimerRef.current);
        }
      };
    }, [viewMode, visualMode, zoom]);

    useEffect(() => {
      const onFullscreenChange = () => {
        setIsFullscreen(Boolean(document.fullscreenElement));
      };
      document.addEventListener("fullscreenchange", onFullscreenChange);
      return () =>
        document.removeEventListener("fullscreenchange", onFullscreenChange);
    }, []);

    const personIndex = useMemo(() => buildPersonIndex(people), [people]);

    const layoutSpacing = useMemo((): LayoutSpacing => {
      return DEFAULT_LAYOUT_SPACING;
    }, []);

    const visibleIds = useMemo(
      () =>
        getVisiblePersonIds({
          mode: viewMode,
          focusId: focusedPersonId,
          people,
          collapsedPersonIds,
        }),
      [collapsedPersonIds, focusedPersonId, people, viewMode],
    );

    const visibleBeforeCollapse = useMemo(
      () =>
        getVisiblePersonIds({
          mode: viewMode,
          focusId: focusedPersonId,
          people,
          collapsedPersonIds: new Set(),
        }),
      [focusedPersonId, people, viewMode],
    );

    const visiblePeople = useMemo(
      () => filterPeopleByIds(people, visibleIds),
      [people, visibleIds],
    );

    const familyViewVisibility = useMemo(
      () =>
        buildFamilyViewPersonIds({
          focusedPersonId,
          people,
        }),
      [focusedPersonId, people],
    );

    const modeCounts = useMemo(
      () => getFamilyViewModeCounts(familyViewVisibility),
      [familyViewVisibility],
    );

    const visiblePhotoPaths = useMemo(
      () => visiblePeople.map((person) => person.photoPath),
      [visiblePeople],
    );
    const { urlsByPath } = usePersonPhotoUrls(visiblePhotoPaths);

    const highlightId = selectedPersonId ?? focusedPersonId;

    const relatedIds = useMemo(() => {
      if (!highlightId) {
        return null;
      }
      return getRelatedPersonIds(highlightId, people);
    }, [highlightId, people]);

    const searchRelatedIds = useMemo(() => {
      if (!searchFlashPersonId) {
        return null;
      }
      return getRelatedPersonIds(searchFlashPersonId, people);
    }, [searchFlashPersonId, people]);

    const hoverRelatedIds = useMemo(() => {
      if (!hoveredPersonId || visualMode !== "heritage") {
        return null;
      }
      return getRelatedPersonIds(hoveredPersonId, people);
    }, [hoveredPersonId, people, visualMode]);

    const focusedLineageIds = useMemo(() => {
      if (visualMode !== "heritage" || !focusedPersonId) {
        return null;
      }
      return getFocusedFamilyPersonIds(focusedPersonId, personIndex);
    }, [focusedPersonId, personIndex, visualMode]);

    const treeDebugEnabled = useTreeDebugEnabled();

    const focusedFamilyModel = useMemo(() => {
      if (visualMode !== "heritage") {
        return null;
      }
      return buildFocusedFamilyModel({
        focusId: focusedPersonId,
        people,
        viewMode,
      });
    }, [focusedPersonId, people, viewMode, visualMode]);

    const assetTreeLayout = useMemo(() => {
      if (visualMode !== "heritage" || !focusedFamilyModel) {
        return null;
      }
      return buildFocusedFamilyLayout({
        model: focusedFamilyModel,
        people,
        viewportWidth,
        isMobile,
        viewMode,
      });
    }, [
      focusedFamilyModel,
      isMobile,
      people,
      viewMode,
      viewportWidth,
      visualMode,
    ]);

    // Diagram still uses mode-filtered visiblePeople; Tree uses focused model people.
    const heritageVisiblePeople = useMemo(() => {
      if (!focusedFamilyModel) return visiblePeople;
      return people.filter((person) =>
        focusedFamilyModel.personIds.has(person.id),
      );
    }, [focusedFamilyModel, people, visiblePeople]);

    const treeIllustrationBounds = useMemo(() => {
      if (!assetTreeLayout?.components.length) {
        return null;
      }
      return computeTreeIllustrationBounds(assetTreeLayout.components);
    }, [assetTreeLayout?.components]);

    const diagramLayout = useMemo(() => {
      if (visualMode !== "diagram") {
        return null;
      }
      return buildLayoutedGraph(visiblePeople, {
        spacing: layoutSpacing,
        nodeSize: DIAGRAM_NODE_SIZE,
        resolveCollisions: false,
        componentGapX: layoutSpacing.componentGap,
      });
    }, [layoutSpacing, visiblePeople, visualMode]);

    const handleExpandCollateral = useCallback(
      (personId: string) => {
        setExpandedCollateralIds((current) => {
          const next = new Set(current);
          next.add(personId);
          return next;
        });
        onSelectPerson(personId);
      },
      [onSelectPerson],
    );

    const { nodes, edges } = useMemo(() => {
      const useLineageDim =
        visualMode === "heritage" &&
        Boolean(focusedLineageIds) &&
        viewMode === "branch";

      const dataById = new Map<string, PersonNodeData>(
        visiblePeople.map((person) => {
          const isSelected = selectedPersonId === person.id;
          const isFocused = focusedPersonId === person.id;
          const isSearchFlash = searchFlashPersonId === person.id;
          const isHighlighted = highlightId === person.id;
          const isRelated = Boolean(
            relatedIds?.has(person.id) && !isHighlighted,
          );
          const isHoverRelated = Boolean(
            hoverRelatedIds?.has(person.id) && !isFocused && !isSelected,
          );
          const isOnFocusedPath = focusedLineageIds
            ? focusedLineageIds.has(person.id)
            : true;
          const isCollapsed = collapsedPersonIds.has(person.id);
          const canCollapse = personHasCollapsibleDescendants(
            person.id,
            personIndex,
            visibleBeforeCollapse,
          );

          const isDimmed = useLineageDim
            ? !isOnFocusedPath && !isHoverRelated && !isSelected
            : Boolean(
                searchFlashPersonId &&
                  searchRelatedIds &&
                  !searchRelatedIds.has(person.id) &&
                  person.id !== searchFlashPersonId,
              );

          return [
            person.id,
            {
              person: {
                ...person,
                photoUrl: resolvePersonPhotoUrl(person.photoPath, urlsByPath),
              },
              onSelect: onSelectPerson,
              isHighlighted,
              isFocused,
              isSelected,
              isSearchFlash,
              isRelated,
              isHoverRelated,
              isOnFocusedPath,
              isDimmed,
              isCompact,
              detailLevel: visualMode === "heritage" ? detailLevel : "full",
              isCollapsed,
              hiddenDescendantCount: getHiddenDescendantCount(
                person.id,
                collapsedPersonIds,
                personIndex,
                visibleBeforeCollapse,
              ),
              canCollapse,
              onToggleCollapse,
            },
          ];
        }),
      );

      if (visualMode === "heritage" && assetTreeLayout) {
        const personNodes: TreeNode[] = assetTreeLayout.nodes.map((node) => {
          const merged = dataById.get(node.id);
          if (!merged) {
            return node;
          }
          return {
            ...node,
            data: {
              ...node.data,
              ...merged,
              isBotanicalCentral: node.data.isBotanicalCentral,
              isBotanicalSpouse: node.data.isBotanicalSpouse,
              botanicalDisplayLevel: node.data.botanicalDisplayLevel,
              labelPlacement: node.data.labelPlacement,
              relationToFocusLabel: node.data.relationToFocusLabel,
            },
          };
        });

        const collapsedNodes: TreeNode[] = assetTreeLayout.collapsedNodes.map(
          (node) => ({
            ...node,
            data: {
              ...node.data,
              onExpand: (personId: string) => {
                if (
                  typeof node.data === "object" &&
                  node.data &&
                  "branchTitle" in node.data &&
                  typeof node.data.branchTitle === "string"
                ) {
                  (onMakeCenter ?? onSelectPerson)(personId);
                  if (viewMode === "all") {
                    onModeActivate("branch");
                  }
                  return;
                }
                handleExpandCollateral(personId);
              },
            },
          }),
        );

        return {
          nodes: [...personNodes, ...collapsedNodes],
          edges: [] as Edge[],
        };
      }

      if (!diagramLayout) {
        return { nodes: [] as TreeNode[], edges: [] as Edge[] };
      }

      const styledEdges: Edge[] = diagramLayout.edges.map((edge) => {
        const edgeHighlightId = searchFlashPersonId ?? null;
        const isRelated = isEdgeRelatedToPerson(
          edge,
          edgeHighlightId,
          searchRelatedIds,
        );

        const baseStroke =
          typeof edge.style?.stroke === "string"
            ? edge.style.stroke
            : EDGE_STROKE;

        return {
          ...edge,
          animated: false,
          style: {
            ...edge.style,
            stroke: isRelated ? "#1F332A" : baseStroke,
            strokeWidth: isRelated ? 2.75 : EDGE_STROKE_WIDTH,
            opacity:
              edgeHighlightId && !isRelated ? 0.52 : isRelated ? 1 : 0.88,
          },
        };
      });

      const treeNodes: TreeNode[] = [
        ...diagramLayout.generationNodes,
        ...applyNodeData(diagramLayout.nodes, dataById),
        ...diagramLayout.junctionNodes,
      ];

      return {
        nodes: treeNodes,
        edges: styledEdges,
      };
    }, [
      assetTreeLayout,
      collapsedPersonIds,
      detailLevel,
      diagramLayout,
      focusedLineageIds,
      handleExpandCollateral,
      highlightId,
      hoverRelatedIds,
      onSelectPerson,
      onToggleCollapse,
      personIndex,
      relatedIds,
      searchFlashPersonId,
      searchRelatedIds,
      selectedPersonId,
      urlsByPath,
      viewMode,
      visibleBeforeCollapse,
      visiblePeople,
      visualMode,
    ]);

    const activeNodeTypes =
      visualMode === "heritage" ? heritageNodeTypes : diagramNodeTypes;

    const preferredZoomForMode = useCallback(() => {
      if (viewMode === "nearby") return NEARBY_ZOOM;
      if (viewMode === "generations") return GENERATIONS_ZOOM;
      if (viewMode === "branch") return BRANCH_ZOOM;
      return FOCUS_ZOOM;
    }, [viewMode]);

    const resolveSearchZoom = useCallback(() => {
      const container = containerRef.current;
      const width = container?.getBoundingClientRect().width ?? 1024;
      if (width < 768) {
        return Math.min(SEARCH_ZOOM_MAX, Math.max(0.75, SEARCH_ZOOM_MIN - 0.05));
      }
      return Math.min(SEARCH_ZOOM_MAX, Math.max(SEARCH_ZOOM_MIN, preferredZoomForMode()));
    }, [preferredZoomForMode]);

    const centerOnPerson = useCallback(
      (personId: string, options?: { search?: boolean; duration?: number; preserveZoom?: boolean }) => {
        const token = ++centerTokenRef.current;
        const duration = options?.duration ?? 700;
        const search = Boolean(options?.search);
        const preserveZoom = Boolean(options?.preserveZoom);

        const attempt = (tries: number) => {
          if (token !== centerTokenRef.current) {
            return;
          }

          const flow = flowInstanceRef.current;
          const node = flow?.getNode(personId);
          if (!flow || !node) {
            if (tries < 24) {
              window.requestAnimationFrame(() => attempt(tries + 1));
            }
            return;
          }

          window.requestAnimationFrame(() => {
            if (token !== centerTokenRef.current) {
              return;
            }

            const latest = flow.getNode(personId);
            if (!latest) {
              return;
            }

            const measured = flow.getNodes().find((item) => item.id === personId);
            const fallbackW =
              visualMode === "heritage" ? BOTANICAL_NODE_WIDTH : NODE_WIDTH;
            const fallbackH =
              visualMode === "heritage" ? BOTANICAL_NODE_HEIGHT : NODE_HEIGHT;
            const width = measured?.measured?.width ?? fallbackW;
            const height = measured?.measured?.height ?? fallbackH;
            const centerX = latest.position.x + width / 2;
            const centerY = latest.position.y + height / 2;
            const nextZoom = preserveZoom
              ? flow.getZoom()
              : search
              ? resolveSearchZoom()
              : Math.max(
                  visualMode === "heritage" ? BOTANICAL_CENTER_ZOOM : 0.92,
                  Math.min(
                    Math.max(preferredZoomForMode(), flow.getZoom()),
                    1.15,
                  ),
                );

            void flow.setCenter(centerX, centerY, {
              zoom: nextZoom,
              duration,
            });
          });
        };

        window.requestAnimationFrame(() => attempt(0));
      },
      [preferredZoomForMode, resolveSearchZoom, visualMode],
    );

    const resolveBoundsForCamera = useCallback(
      (
        personNodes: TreeNode[],
        mode: "focused" | "all",
      ) => {
        if (visualMode === "heritage" && assetTreeLayout) {
          const boundsSet = computeTreeViewBoundsSet(
            assetTreeLayout.components,
            personNodes,
            treeIllustrationBounds,
          );
          if (mode === "all") {
            return boundsSet.allContentBounds ?? boundsSet.focusedTreeBounds;
          }
          return boundsSet.focusedTreeBounds ?? boundsSet.allContentBounds;
        }

        if (visualMode === "diagram") {
          const boundsSet = computeDiagramViewBoundsSet(
            personNodes,
            people,
            focusedPersonId,
          );
          if (mode === "all") {
            return boundsSet.allContentBounds ?? boundsSet.focusedTreeBounds;
          }
          return boundsSet.focusedTreeBounds ?? boundsSet.allContentBounds;
        }

        const raw = getNodesBounds(personNodes);
        return raw.width > 0 && raw.height > 0 ? raw : null;
      },
      [
        assetTreeLayout,
        focusedPersonId,
        people,
        treeIllustrationBounds,
        visualMode,
      ],
    );

    const resolveFloorZoom = useCallback(
      (mode: "focused" | "all") => {
        if (visualMode === "heritage") {
          if (mode === "all" && viewMode === "all") {
            return includeDetachedOnCanvas
              ? Math.max(FIT_MIN_ZOOM, BOTANICAL_ALL_MIN_ZOOM * 0.82)
              : BOTANICAL_ALL_MIN_ZOOM;
          }
          switch (viewMode) {
            case "nearby":
              return BOTANICAL_NEARBY_MIN_ZOOM;
            case "generations":
              return BOTANICAL_GENERATIONS_MIN_ZOOM;
            case "branch":
              return BOTANICAL_BRANCH_MIN_ZOOM;
            case "all":
              return BOTANICAL_ALL_MIN_ZOOM;
            default:
              return BOTANICAL_ALL_MIN_ZOOM;
          }
        }

        if (mode === "all") {
          return DIAGRAM_ALL_FIT_MIN_ZOOM;
        }
        switch (viewMode) {
          case "nearby":
            return 0.82;
          case "generations":
            return 0.76;
          case "branch":
            return 0.72;
          case "all":
            return DIAGRAM_ALL_MIN_ZOOM;
          default:
            return DIAGRAM_ALL_MIN_ZOOM;
        }
      },
      [includeDetachedOnCanvas, viewMode, visualMode],
    );

    const applyCameraToBounds = useCallback(
      (
        bounds: { x: number; y: number; width: number; height: number } | null,
        mode: "focused" | "all",
        duration = 420,
      ) => {
        const flow = flowInstanceRef.current;
        const container = containerRef.current;
        if (!flow || !container || !bounds || bounds.width <= 0 || bounds.height <= 0) {
          return;
        }

        const { width, height } = container.getBoundingClientRect();
        if (width <= 0 || height <= 0) {
          return;
        }

        const heightFill =
          visualMode === "heritage"
            ? heritageHeightFill(viewMode)
            : viewMode === "nearby"
              ? 0.86
              : viewMode === "generations"
                ? 0.84
                : mode === "all"
                  ? 0.76
                  : 0.8;
        const widthRatio =
          visualMode === "heritage"
            ? heritageWidthRatio(width)
            : width >= 1366
              ? 0.82
              : width >= 768
                ? 0.88
                : 0.94;
        const heritageMaxZoom =
          viewMode === "nearby" ? 1.48 : viewMode === "generations" ? 1.38 : 1.28;
        const maxZoom =
          visualMode === "heritage" ? heritageMaxZoom : FIT_MAX_ZOOM;

        const nextZoom = computeCameraZoom({
          bounds,
          containerWidth: width,
          containerHeight: height,
          heightFill,
          widthRatio,
          floorZoom: resolveFloorZoom(mode),
          maxZoom,
        });
        const center = boundsCenter(bounds);

        void flow.setCenter(center.x, center.y, {
          zoom: nextZoom,
          duration,
        });
      },
      [resolveFloorZoom, viewMode, visualMode],
    );

    const applyReadableView = useCallback(
      (instance?: TreeInstance | null) => {
        const flow = instance ?? flowInstanceRef.current;
        const container = containerRef.current;
        if (!flow || !container || hasInitializedView.current) {
          return;
        }

        if (
          visualMode === "heritage" &&
          assetTreeLayout?.focusCenter &&
          focusedPersonId
        ) {
          const { width, height } = container.getBoundingClientRect();
          if (width <= 0 || height <= 0) {
            return;
          }
          const floorZoom = resolveFloorZoom("focused");
          const nextZoom = Math.min(
            viewMode === "nearby" ? 1.2 : 1.05,
            Math.max(floorZoom, viewMode === "nearby" ? 0.95 : 0.82),
          );
          void flow.setCenter(
            assetTreeLayout.focusCenter.x,
            assetTreeLayout.focusCenter.y,
            { zoom: nextZoom, duration: 420 },
          );
          hasInitializedView.current = true;
          window.setTimeout(() => setViewReady(true), 80);
          return;
        }

        const personNodes = flow
          .getNodes()
          .filter((node) => node.type === "person");
        if (personNodes.length === 0) {
          return;
        }

        const bounds = resolveBoundsForCamera(personNodes, "focused");
        applyCameraToBounds(bounds, "focused");

        hasInitializedView.current = true;
        window.setTimeout(() => setViewReady(true), 80);
      },
      [
        applyCameraToBounds,
        assetTreeLayout?.focusCenter,
        focusedPersonId,
        resolveBoundsForCamera,
        resolveFloorZoom,
        viewMode,
        visualMode,
      ],
    );

    const fitAllVisible = useCallback(() => {
      setIncludeDetachedOnCanvas(true);
      window.setTimeout(() => {
        const flow = flowInstanceRef.current;
        if (!flow) {
          return;
        }
        const personNodes = flow
          .getNodes()
          .filter((node) => node.type === "person");
        if (personNodes.length === 0) {
          return;
        }
        const bounds = resolveBoundsForCamera(personNodes, "all");
        applyCameraToBounds(bounds, "all", 700);
      }, 160);
    }, [applyCameraToBounds, resolveBoundsForCamera]);

    useEffect(() => {
      const key = `${visualMode}|${viewMode}`;
      if (cameraResetKeyRef.current === key) {
        return;
      }
      cameraResetKeyRef.current = key;
      hasInitializedView.current = false;
      setIncludeDetachedOnCanvas(false);
      setPinnedDetachedFocusIds(new Set());
      setViewReady(false);
    }, [viewMode, visualMode]);

    useEffect(() => {
      if (visiblePeople.length === 0 || !flowInstanceRef.current) {
        return;
      }

      if (!hasInitializedView.current) {
        setViewReady(false);
        const timeoutId = window.setTimeout(() => {
          applyReadableView(flowInstanceRef.current);
        }, 80);
        return () => window.clearTimeout(timeoutId);
      }
    }, [applyReadableView, visiblePeople.length, viewMode, visualMode]);

    const lastCenteredFocusRef = useRef<string | null>(null);

    useEffect(() => {
      if (visualMode !== "heritage" || !focusedPersonId || !assetTreeLayout?.focusCenter) {
        return;
      }
      if (lastCenteredFocusRef.current === focusedPersonId) {
        return;
      }
      lastCenteredFocusRef.current = focusedPersonId;
      const timeoutId = window.setTimeout(() => {
        centerOnPerson(focusedPersonId, { duration: 650 });
      }, 140);
      return () => window.clearTimeout(timeoutId);
    }, [
      assetTreeLayout?.focusCenter,
      centerOnPerson,
      focusedPersonId,
      visualMode,
    ]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container || !focusedPersonId) {
        return;
      }

      const observer = new ResizeObserver(() => {
        if (!hasInitializedView.current) {
          return;
        }
        centerOnPerson(focusedPersonId, {
          duration: 280,
          preserveZoom: true,
        });
      });

      observer.observe(container);
      return () => observer.disconnect();
    }, [centerOnPerson, focusedPersonId]);

    useImperativeHandle(
      ref,
      () => ({
        focusPerson: (personId, options) => {
          centerOnPerson(personId, {
            search: options?.search,
            duration: options?.search ? 720 : 650,
          });
        },
        fitView: fitAllVisible,
        focusCurrentUser: () => {
          centerOnPerson(focusedPersonId ?? currentUserId);
        },
      }),
      [centerOnPerson, currentUserId, fitAllVisible, focusedPersonId],
    );

    const toggleFullscreen = useCallback(async () => {
      const element = containerRef.current;
      if (!element) {
        return;
      }

      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          return;
        }

        await element.requestFullscreen();
      } catch {
        onToggleTreeOnly();
      }
    }, [onToggleTreeOnly]);

    const handleNodeClick = useCallback(
      (event: MouseEvent, node: TreeNode) => {
        if (node.type === "botanicalCollapsed") {
          event.stopPropagation();
          const anchorPersonId =
            typeof node.data === "object" &&
            node.data &&
            "anchorPersonId" in node.data &&
            typeof node.data.anchorPersonId === "string"
              ? node.data.anchorPersonId
              : null;
          if (anchorPersonId) {
            handleExpandCollateral(anchorPersonId);
          }
          return;
        }
        if (node.type !== "person") {
          return;
        }
        event.stopPropagation();
        onSelectPerson(node.id);
      },
      [handleExpandCollateral, onSelectPerson],
    );

    const handleShowAll = useCallback(() => {
      if (viewMode !== "all") {
        onModeActivate("all");
      }
      window.setTimeout(() => fitAllVisible(), viewMode !== "all" ? 200 : 120);
    }, [fitAllVisible, onModeActivate, viewMode]);

    const handleShowDetachedComponent = useCallback(
      (focusId: string) => {
        setPinnedDetachedFocusIds((current) => new Set([...current, focusId]));
        onSelectPerson(focusId);
        window.setTimeout(() => {
          centerOnPerson(focusId, { duration: 650 });
        }, 160);
      },
      [centerOnPerson, onSelectPerson],
    );

    const showMiniMap =
      miniMapVisible &&
      visualMode === "diagram" &&
      !isMobile &&
      visiblePeople.length >= MINIMAP_THRESHOLD;

    const handleFocusNearby = useCallback(() => {
      onModeActivate("nearby");
    }, [onModeActivate]);

    const detachedComponents =
      viewMode === "all"
        ? (assetTreeLayout?.model.branchCards
            .filter((card) => card.id.startsWith("detached-"))
            .map((card) => ({
              componentId: card.id,
              focusId: card.rootPersonId,
              personIds: card.personIds,
              people: card.personIds
                .map((id) => people.find((person) => person.id === id))
                .filter((person): person is Person => Boolean(person)),
            })) ?? [])
        : [];

    return (
      <div
        ref={containerRef}
        className={[
          "tree-canvas absolute inset-0 h-full w-full",
          visualMode === "heritage" ? "heritage-canvas" : "diagram-canvas",
        ].join(" ")}
        data-visual-mode={visualMode}
        data-detail-level={detailLevel}
      >
        {visualMode === "heritage" ? <HeritageTreeBackdrop /> : null}
        {visualMode === "diagram" ? <DiagramCanvasBackdrop /> : null}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={activeNodeTypes}
          onInit={(instance) => {
            flowInstanceRef.current = instance;
            window.setTimeout(() => {
              applyReadableView(instance);
            }, 60);
          }}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={(_event, node) => {
            if (visualMode === "heritage" && node.type === "person") {
              setHoveredPersonId(node.id);
            }
          }}
          onNodeMouseLeave={() => {
            setHoveredPersonId(null);
          }}
          minZoom={FIT_MIN_ZOOM}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          panOnDrag
          elevateEdgesOnSelect={false}
          defaultEdgeOptions={{
            markerEnd: undefined,
            type: "smoothstep",
          }}
          className="family-tree-flow"
        >
          {visualMode === "heritage" ? (
            <>
              <AssetTreeLayer components={assetTreeLayout?.components ?? []} />
              <SoftBranchOverlay links={assetTreeLayout?.softLinks ?? []} />
              <TreeDebugOverlay
                components={assetTreeLayout?.components ?? []}
                people={heritageVisiblePeople}
                enabled={treeDebugEnabled}
              />
            </>
          ) : null}
          {showMiniMap ? (
            <MiniMap
              nodeColor={(node) => {
                if (
                  node.type === "junction" ||
                  node.type === "generationLabel" ||
                  node.type === "botanicalCollapsed"
                ) {
                  return "transparent";
                }
                if (node.type === "union") {
                  return "#B8953D";
                }
                if (node.id === focusedPersonId) {
                  return "#1A2E24";
                }
                if (focusedLineageIds?.has(node.id)) {
                  return "#3D5A4C";
                }
                return "#8FA093";
              }}
              maskColor="rgba(245, 240, 232, 0.72)"
              className="!bottom-4 !right-4 !h-28 !w-40 overflow-hidden rounded-xl border border-[#D9D0C3] bg-[#FFFCF7] shadow-[0_4px_14px_rgba(31,51,42,0.12)]"
              pannable
              zoomable
            />
          ) : null}
        </ReactFlow>

        <TreeToolbar
          viewMode={viewMode}
          onModeActivate={onModeActivate}
          visualMode={visualMode}
          onVisualModeChange={onVisualModeChange}
          focusLabel={focusLabel}
          focusLabelShort={focusLabelShort}
          modeCounts={modeCounts}
          shownCount={visibleBeforeCollapse.size}
          totalCount={modeCounts.all}
          onZoomIn={() => reactFlow.zoomIn({ duration: 250 })}
          onZoomOut={() => reactFlow.zoomOut({ duration: 250 })}
          onFitView={handleShowAll}
          onCenterFocused={() => {
            if (focusedPersonId) {
              centerOnPerson(focusedPersonId);
            }
          }}
          onFocusNearby={handleFocusNearby}
          onExpandAll={onExpandAll}
          hasCollapsedBranches={collapsedPersonIds.size > 0}
          onToggleFullscreen={() => {
            void toggleFullscreen();
          }}
          onToggleTreeOnly={onToggleTreeOnly}
          isFullscreen={isFullscreen}
          isTreeOnly={isTreeOnly}
          showMiniMapToggle
          miniMapVisible={miniMapVisible}
          onToggleMiniMap={() => setMiniMapVisible((current) => !current)}
        />
        <TreeCenterHint />
        {detachedComponents.length > 0 && visualMode === "heritage" ? (
          <div className="pointer-events-none absolute right-4 top-4 z-[210] sm:right-6">
            <DisconnectedPeoplePanel
              detachedComponents={detachedComponents}
              onOpenProfile={onSelectPerson}
              onMakeCenter={onMakeCenter ?? onSelectPerson}
              onShowComponent={handleShowDetachedComponent}
            />
          </div>
        ) : null}
        <RelationshipLegend visualMode={visualMode} />
      </div>
    );
  },
);

export const FamilyTree = forwardRef<FamilyTreeHandle, FamilyTreeProps>(
  function FamilyTree(props, ref) {
    return (
      <ReactFlowProvider>
        <FamilyTreeCanvas ref={ref} {...props} />
      </ReactFlowProvider>
    );
  },
);
