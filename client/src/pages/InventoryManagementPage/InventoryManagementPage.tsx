'use client';

import {
  ArrowDownToLine,
  ArrowLeft,
  Barcode,
  Boxes,
  Camera,
  Calculator,
  CircleDollarSign,
  ClipboardMinus,
  FilePenLine,
  History,
  PackagePlus,
  Search,
  ShieldCheck,
  ShoppingBag,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type {
  CustomerAssetSummary,
  InventoryDashboardResponse,
  InventoryMovement,
  InventoryMovementType,
  InventoryProduct,
} from '@shared/api.interface';
import {
  createInventoryProduct,
  getCurrentServiceRole,
  getCustomerAssets,
  getInventoryDashboard,
  inboundInventory,
  internalUseInventory,
  sellInventoryToCustomer,
  updateInventoryProductCost,
} from '../../api';
import { Badge } from '../../components/ui/badge';
import CustomerMembershipBadge from '../../components/CustomerMembershipBadge';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import './inventory-management.css';

type ActionMode = 'inbound' | 'internal_use' | 'customer_sale';
type InboundEntryMethod = 'scan' | 'manual';

type ProductDraft = {
  barcode: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  purchaseCostExact: string;
  retailPriceExact: string;
  defaultDiscountPercentExact: string;
  safetyStockExact: string;
  supplier: string;
  note: string;
};

type MovementDraft = {
  productId: string;
  barcode: string;
  quantityExact: string;
  unitCostExact: string;
  supplier: string;
  batchNo: string;
  expiresOn: string;
  recipientName: string;
  purpose: string;
  customerAssetId: string;
  customerName: string;
  discountPercentExact: string;
  note: string;
};

type CostDraft = {
  purchaseCostExact: string;
  retailPriceExact: string;
  defaultDiscountPercentExact: string;
  supplier: string;
  note: string;
};

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorConstructor = new (options: {
  formats: string[];
}) => BarcodeDetectorLike;

const EMPTY_PRODUCT: ProductDraft = {
  barcode: '',
  sku: '',
  name: '',
  category: '零售产品',
  unit: '件',
  purchaseCostExact: '0.00',
  retailPriceExact: '0.00',
  defaultDiscountPercentExact: '100',
  safetyStockExact: '0',
  supplier: '',
  note: '',
};

const EMPTY_MOVEMENT: MovementDraft = {
  productId: '',
  barcode: '',
  quantityExact: '1',
  unitCostExact: '0.00',
  supplier: '',
  batchNo: '',
  expiresOn: '',
  recipientName: '',
  purpose: '',
  customerAssetId: '',
  customerName: '',
  discountPercentExact: '100',
  note: '',
};

const ACTION_COPY: Record<
  ActionMode,
  { title: string; description: string; submit: string }
> = {
  inbound: {
    title: '扫码入库',
    description:
      '货品到店后扫描条码，填写数量、成本、批次和效期，形成入库流水。',
    submit: '确认入库',
  },
  internal_use: {
    title: '内部领用出库',
    description: '仅减少库存并记录领用人与用途，不产生营业收入。',
    submit: '确认领用出库',
  },
  customer_sale: {
    title: '销售给客户',
    description: '按产品零售价、数量和折扣自动计算实收，并关联客户档案。',
    submit: '确认销售出库',
  },
};

const MANUAL_INBOUND_COPY = {
  title: '手动入库',
  description:
    '无条码、条码不完整或暂时无法扫码时，手动选择或新建产品并填写入库信息。',
  submit: '确认手动入库',
};

function newIdempotencyKey(): string {
  return typeof crypto.randomUUID === 'function'
    ? `inventory-${crypto.randomUUID()}`
    : `inventory-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorText(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}

function money(value: string): string {
  return `¥${Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function movementLabel(type: InventoryMovementType): string {
  if (type === 'inbound') return '扫码入库';
  if (type === 'internal_use') return '内部领用';
  return '客户销售';
}

function BarcodeCamera({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const [message, setMessage] = useState('正在启动后置摄像头…');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const stop = () => {
      if (animationRef.current !== null)
        cancelAnimationFrame(animationRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    const start = async () => {
      const Detector = (
        window as Window & {
          BarcodeDetector?: BarcodeDetectorConstructor;
        }
      ).BarcodeDetector;
      if (!Detector) {
        setMessage('当前设备不支持相机识码，可使用扫码枪或直接输入条码。');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setMessage('请将产品条码放入取景框');
        const detector = new Detector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code'],
        });
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();
            if (value) {
              onDetected(value);
              onClose();
              return;
            }
          } catch {
            // Camera can briefly reject frames while focusing; keep scanning.
          }
          animationRef.current = requestAnimationFrame(scan);
        };
        animationRef.current = requestAnimationFrame(scan);
      } catch {
        setMessage('无法使用摄像头，请检查飞书相机权限，或直接输入产品条码。');
      }
    };
    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [onClose, onDetected, open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="inventory-camera-dialog">
        <DialogHeader>
          <DialogTitle>扫描产品条码</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div className="inventory-camera-frame">
          <video ref={videoRef} muted playsInline />
          <span className="inventory-scan-line" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function InventoryManagementPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [dashboard, setDashboard] = useState<InventoryDashboardResponse | null>(
    null,
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [inboundEntryMethod, setInboundEntryMethod] =
    useState<InboundEntryMethod>('scan');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productDraft, setProductDraft] = useState<ProductDraft>(EMPTY_PRODUCT);
  const [costProduct, setCostProduct] = useState<InventoryProduct | null>(null);
  const [costDraft, setCostDraft] = useState<CostDraft>({
    purchaseCostExact: '0.00',
    retailPriceExact: '0.00',
    defaultDiscountPercentExact: '100',
    supplier: '',
    note: '',
  });
  const [movementDraft, setMovementDraft] =
    useState<MovementDraft>(EMPTY_MOVEMENT);
  const [customerResults, setCustomerResults] = useState<
    CustomerAssetSummary[]
  >([]);

  const reload = useCallback(async () => {
    const data = await getInventoryDashboard();
    setDashboard(data);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const role = await getCurrentServiceRole();
        if (!active) return;
        const canManage = role.permissions.manageInventory;
        setAuthorized(canManage);
        setIsOwner(role.role === 'owner');
        if (canManage) await reload();
      } catch (error) {
        toast.error(errorText(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reload]);

  useEffect(() => {
    const normalized = movementDraft.customerName.trim();
    if (!normalized || actionMode !== 'customer_sale') {
      setCustomerResults([]);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void getCustomerAssets({ query: normalized, page: 1, pageSize: 8 })
        .then((response) => setCustomerResults(response.items))
        .catch(() => setCustomerResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [actionMode, movementDraft.customerName]);

  const products = dashboard?.products || [];
  const categories = useMemo(
    () => [
      '全部',
      ...Array.from(new Set(products.map((product) => product.category))),
    ],
    [products],
  );
  const visibleProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        category === '全部' || product.category === category;
      const matchesQuery =
        !keyword ||
        [
          product.name,
          product.barcode,
          product.sku || '',
          product.category,
          product.supplier || '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      return matchesCategory && matchesQuery;
    });
  }, [category, products, query]);
  const selectedProduct = products.find(
    (product) => product.id === movementDraft.productId,
  );
  const saleAmount = selectedProduct
    ? (
        Number(selectedProduct.retailPriceExact) *
        Number(movementDraft.quantityExact || 0) *
        (Number(movementDraft.discountPercentExact || 0) / 100)
      ).toFixed(2)
    : '0.00';

  const setMovementProduct = (product: InventoryProduct) => {
    setMovementDraft((current) => ({
      ...current,
      productId: product.id,
      barcode: product.barcode,
      unitCostExact: product.purchaseCostExact,
      supplier: product.supplier || '',
      discountPercentExact: product.defaultDiscountPercentExact,
    }));
  };

  const resolveBarcode = (barcode: string) => {
    const normalized = barcode.trim();
    const product = products.find((item) => item.barcode === normalized);
    setMovementDraft((current) => ({ ...current, barcode: normalized }));
    if (product) {
      setMovementProduct(product);
      toast.success(`已识别：${product.name}`);
      return;
    }
    setProductDraft({ ...EMPTY_PRODUCT, barcode: normalized });
    setProductDialogOpen(true);
    toast.info('条码尚未建档，请先补充产品信息');
  };

  const openAction = (
    mode: ActionMode,
    product?: InventoryProduct,
    entryMethod: InboundEntryMethod = 'scan',
  ) => {
    const next = { ...EMPTY_MOVEMENT };
    if (product) {
      next.productId = product.id;
      next.barcode = product.barcode;
      next.unitCostExact = product.purchaseCostExact;
      next.supplier = product.supplier || '';
      next.discountPercentExact = product.defaultDiscountPercentExact;
    }
    setMovementDraft(next);
    setCustomerResults([]);
    if (mode === 'inbound') setInboundEntryMethod(entryMethod);
    setActionMode(mode);
  };

  const saveProduct = async () => {
    setSaving(true);
    try {
      const response = await createInventoryProduct(productDraft);
      await reload();
      setProductDialogOpen(false);
      setProductDraft(EMPTY_PRODUCT);
      if (actionMode) setMovementProduct(response.product);
      toast.success(
        actionMode === 'inbound' && inboundEntryMethod === 'manual'
          ? '产品档案已保存，可以继续填写入库数量'
          : '产品档案已保存，可以继续入库',
      );
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  const saveMovement = async () => {
    if (!actionMode) return;
    setSaving(true);
    const idempotencyKey = newIdempotencyKey();
    try {
      if (actionMode === 'inbound') {
        await inboundInventory({
          productId: movementDraft.productId,
          quantityExact: movementDraft.quantityExact,
          unitCostExact: movementDraft.unitCostExact,
          supplier: movementDraft.supplier,
          batchNo: movementDraft.batchNo,
          expiresOn: movementDraft.expiresOn,
          note: movementDraft.note,
          idempotencyKey,
        });
        toast.success('入库成功，库存已增加');
      } else if (actionMode === 'internal_use') {
        await internalUseInventory({
          productId: movementDraft.productId,
          quantityExact: movementDraft.quantityExact,
          recipientName: movementDraft.recipientName,
          purpose: movementDraft.purpose,
          note: movementDraft.note,
          idempotencyKey,
        });
        toast.success('内部领用已出库，本单收入 ¥0.00');
      } else {
        await sellInventoryToCustomer({
          productId: movementDraft.productId,
          quantityExact: movementDraft.quantityExact,
          customerAssetId: movementDraft.customerAssetId || undefined,
          customerName: movementDraft.customerName,
          discountPercentExact: movementDraft.discountPercentExact,
          actualAmountExact: saleAmount,
          note: movementDraft.note,
          idempotencyKey,
        });
        toast.success(`销售出库成功，实收 ${money(saleAmount)}`);
      }
      await reload();
      setActionMode(null);
      setMovementDraft(EMPTY_MOVEMENT);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  const openCostEditor = (product?: InventoryProduct) => {
    const target: InventoryProduct | undefined =
      product || products.find((item) => item.status === 'active');
    if (!target) {
      toast.info('请先新增产品档案');
      return;
    }
    setCostProduct(target);
    setCostDraft({
      purchaseCostExact: target.purchaseCostExact,
      retailPriceExact: target.retailPriceExact,
      defaultDiscountPercentExact: target.defaultDiscountPercentExact,
      supplier: target.supplier || '',
      note: target.note || '',
    });
  };

  const saveCost = async () => {
    if (!costProduct || !isOwner) return;
    setSaving(true);
    try {
      await updateInventoryProductCost(costProduct.id, costDraft);
      await reload();
      setCostProduct(null);
      toast.success('产品成本、售价和折扣已更新，毛利口径同步刷新');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="inventory-page inventory-state-page">
        正在核对门店权限与库存数据…
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="inventory-page inventory-state-page">
        <ShieldCheck size={44} />
        <h1>当前账号没有产品管理权限</h1>
        <p>产品入库、领用和销售仅老板与前台可以操作。</p>
        <Button onClick={() => navigate('/')}>返回员工工作台</Button>
      </main>
    );
  }

  const summary = dashboard?.summary;

  return (
    <main className="inventory-page">
      <header className="inventory-header">
        <div>
          <Button
            variant="ghost"
            className="inventory-back"
            onClick={() => navigate('/')}
          >
            <ArrowLeft /> 返回工作台
          </Button>
          <p className="inventory-eyebrow">
            老板 / 前台可操作 · 妙搭云数据库实时共享
          </p>
          <h1>产品与库存管理</h1>
          <p>
            一张产品档案，串联扫码入库、内部领用和客户销售；每一步都有独立流水。
          </p>
        </div>
        <Badge variant="outline" className="inventory-cloud-badge">
          <ShieldCheck /> 云端流水已启用
        </Badge>
      </header>

      <section className="inventory-summary-grid" aria-label="库存汇总">
        <article className="inventory-summary-card blue">
          <Boxes />
          <span>在管产品</span>
          <strong>{summary?.productCount || 0} 种</strong>
          <small>实时库存 {summary?.totalStockExact || '0'} 件/单位</small>
        </article>
        {isOwner ? (
          <article className="inventory-summary-card purple">
            <CircleDollarSign />
            <span>库存成本</span>
            <strong>{money(summary?.stockCostValueExact || '0')}</strong>
            <small>仅老板可见 · 按最新进货成本估算</small>
          </article>
        ) : (
          <article className="inventory-summary-card purple">
            <Boxes />
            <span>库存状态</span>
            <strong>{summary?.totalStockExact || '0'} 件/单位</strong>
            <small>前台不显示成本与毛利数据</small>
          </article>
        )}
        <article
          className={`inventory-summary-card ${summary?.lowStockCount ? 'red' : 'green'}`}
        >
          <TriangleAlert />
          <span>安全库存提醒</span>
          <strong>{summary?.lowStockCount || 0} 种</strong>
          <small>低于或等于安全库存</small>
        </article>
        <article className="inventory-summary-card orange">
          <ShoppingBag />
          <span>今日产品销售</span>
          <strong>{money(summary?.todaySalesAmountExact || '0')}</strong>
          <small>
            销售出库 {summary?.todayCustomerSaleExact || '0'} 件/单位
          </small>
        </article>
      </section>

      <section className="inventory-action-panel">
        <div className="inventory-section-heading">
          <div>
            <p>库存操作</p>
            <h2>选择今天要执行的环节</h2>
          </div>
          <Button variant="outline" onClick={() => setProductDialogOpen(true)}>
            <PackagePlus /> 新增产品档案
          </Button>
        </div>
        <div className="inventory-action-grid">
          <button
            type="button"
            className="inventory-action-card inbound"
            onClick={() => openAction('inbound')}
          >
            <span>
              <ArrowDownToLine />
            </span>
            <div>
              <strong>扫码入库</strong>
              <p>进货到店，扫描条码后增加库存</p>
            </div>
          </button>
          {isOwner && (
            <button
              type="button"
              className="inventory-action-card cost"
              onClick={() => openCostEditor()}
            >
              <span>
                <Calculator />
              </span>
              <div>
                <strong>成本管理</strong>
                <p>维护进货成本、零售价和毛利核算口径</p>
              </div>
            </button>
          )}
          <button
            type="button"
            className="inventory-action-card manual"
            onClick={() => openAction('inbound', undefined, 'manual')}
          >
            <span>
              <FilePenLine />
            </span>
            <div>
              <strong>手动入库</strong>
              <p>没有完整条码也能建档并增加库存</p>
            </div>
          </button>
          <button
            type="button"
            className="inventory-action-card internal"
            onClick={() => openAction('internal_use')}
          >
            <span>
              <ClipboardMinus />
            </span>
            <div>
              <strong>内部领用</strong>
              <p>减少库存，记录领用人，不计收入</p>
            </div>
          </button>
          <button
            type="button"
            className="inventory-action-card sale"
            onClick={() => openAction('customer_sale')}
          >
            <span>
              <ShoppingBag />
            </span>
            <div>
              <strong>销售给客户</strong>
              <p>按价格与折扣结算，并关联客户档案</p>
            </div>
          </button>
        </div>
      </section>

      <section className="inventory-product-section">
        <div className="inventory-section-heading">
          <div>
            <p>产品主档</p>
            <h2>当前库存与销售价格</h2>
          </div>
          <div className="inventory-search">
            <Search />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索名称、条码、分类或供应商"
            />
          </div>
        </div>
        <div className="inventory-category-row">
          {categories.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={category === item ? 'default' : 'outline'}
              onClick={() => setCategory(item)}
            >
              {item}
            </Button>
          ))}
        </div>
        <div className="inventory-product-grid">
          {visibleProducts.map((product) => (
            <article
              key={product.id}
              className={`inventory-product-card ${product.lowStock ? 'low-stock' : ''}`}
            >
              <div className="inventory-product-title">
                <span>
                  <Barcode />
                </span>
                <div>
                  <h3>{product.name}</h3>
                  <p>
                    {product.category} · {product.barcode}
                  </p>
                </div>
                {product.lowStock && (
                  <Badge variant="destructive">低库存</Badge>
                )}
              </div>
              <div className="inventory-product-metrics">
                <div>
                  <span>现有库存</span>
                  <strong>
                    {product.currentStockExact} {product.unit}
                  </strong>
                </div>
                <div>
                  <span>零售价</span>
                  <strong>{money(product.retailPriceExact)}</strong>
                </div>
                {isOwner && (
                  <div>
                    <span>进货成本</span>
                    <strong>{money(product.purchaseCostExact)}</strong>
                  </div>
                )}
                <div>
                  <span>默认折扣</span>
                  <strong>{product.defaultDiscountPercentExact}%</strong>
                </div>
                <div>
                  <span>安全库存</span>
                  <strong>
                    {product.safetyStockExact} {product.unit}
                  </strong>
                </div>
              </div>
              <div className="inventory-product-actions">
                {isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openCostEditor(product)}
                  >
                    成本 / 售价
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openAction('inbound', product, 'manual')}
                >
                  入库
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openAction('internal_use', product)}
                >
                  领用
                </Button>
                <Button
                  size="sm"
                  onClick={() => openAction('customer_sale', product)}
                >
                  销售
                </Button>
              </div>
            </article>
          ))}
          {!visibleProducts.length && (
            <div className="inventory-empty">
              暂无匹配产品。可以扫码建档，也可以通过手动入库新增产品。
            </div>
          )}
        </div>
      </section>

      <section className="inventory-ledger-section">
        <div className="inventory-section-heading">
          <div>
            <p>不可覆盖流水</p>
            <h2>最近入库与出库记录</h2>
          </div>
          <History />
        </div>
        <div className="inventory-ledger-list">
          {(dashboard?.movements || []).map((movement: InventoryMovement) => (
            <article key={movement.id}>
              <span
                className={`inventory-movement-icon ${movement.movementType}`}
              >
                {movement.movementType === 'inbound' ? '+' : '−'}
              </span>
              <div className="inventory-ledger-main">
                <h3>
                  {movement.productName}
                  <Badge variant="outline">
                    {movementLabel(movement.movementType)}
                  </Badge>
                </h3>
                <p>
                  {new Date(movement.occurredAt).toLocaleString('zh-CN')} ·{' '}
                  {movement.operatorName} · 流水 {movement.movementNo}
                </p>
                <small>
                  {movement.movementType === 'internal_use'
                    ? `领用人 ${movement.recipientName || '—'} · 用途 ${movement.purpose || '—'} · 不产生消费`
                    : movement.movementType === 'customer_sale'
                      ? `客户 ${movement.customerName || '—'} · 原价 ${money(movement.listPriceExact)} · 折扣 ${movement.discountPercentExact}%`
                      : `供应商 ${movement.supplier || '—'} · 批次 ${movement.batchNo || '—'}`}
                </small>
              </div>
              <div className="inventory-ledger-amount">
                <strong>{movement.deltaQuantityExact}</strong>
                <span>
                  {movement.movementType === 'customer_sale'
                    ? money(movement.actualAmountExact)
                    : movement.movementType === 'internal_use'
                      ? '收入 ¥0.00'
                      : isOwner
                        ? `成本 ${money(movement.unitCostExact)}`
                        : '入库已记录'}
                </span>
              </div>
            </article>
          ))}
          {!dashboard?.movements.length && (
            <div className="inventory-empty">
              还没有库存流水，首次扫码入库后会显示在这里。
            </div>
          )}
        </div>
      </section>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="inventory-dialog inventory-product-dialog">
          <DialogHeader>
            <DialogTitle>新增产品档案</DialogTitle>
            <DialogDescription>
              条码可选填。没有完整条码时，系统会自动生成内部货号。
            </DialogDescription>
          </DialogHeader>
          <div className="inventory-form-grid">
            <div className="wide">
              <Label>产品条码（选填）</Label>
              <div className="inventory-inline-field">
                <Input
                  value={productDraft.barcode}
                  onChange={(event) =>
                    setProductDraft((current) => ({
                      ...current,
                      barcode: event.target.value,
                    }))
                  }
                  placeholder="可扫码、手动输入或留空"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCameraOpen(true)}
                >
                  <Camera /> 扫码
                </Button>
              </div>
            </div>
            <div className="wide">
              <Label>产品名称</Label>
              <Input
                value={productDraft.name}
                onChange={(event) =>
                  setProductDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="例如：修护面膜"
              />
            </div>
            <div>
              <Label>分类</Label>
              <Input
                value={productDraft.category}
                onChange={(event) =>
                  setProductDraft((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>SKU（选填）</Label>
              <Input
                value={productDraft.sku}
                onChange={(event) =>
                  setProductDraft((current) => ({
                    ...current,
                    sku: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>计量单位</Label>
              <Input
                value={productDraft.unit}
                onChange={(event) =>
                  setProductDraft((current) => ({
                    ...current,
                    unit: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>供应商</Label>
              <Input
                value={productDraft.supplier}
                onChange={(event) =>
                  setProductDraft((current) => ({
                    ...current,
                    supplier: event.target.value,
                  }))
                }
              />
            </div>
            {isOwner && (
              <div>
                <Label>进货成本（元）</Label>
                <Input
                  inputMode="decimal"
                  value={productDraft.purchaseCostExact}
                  onChange={(event) =>
                    setProductDraft((current) => ({
                      ...current,
                      purchaseCostExact: event.target.value,
                    }))
                  }
                />
              </div>
            )}
            <div>
              <Label>零售价（元）</Label>
              <Input
                inputMode="decimal"
                value={productDraft.retailPriceExact}
                onChange={(event) =>
                  setProductDraft((current) => ({
                    ...current,
                    retailPriceExact: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>默认销售折扣（%）</Label>
              <Input
                inputMode="decimal"
                value={productDraft.defaultDiscountPercentExact}
                onChange={(event) =>
                  setProductDraft((current) => ({
                    ...current,
                    defaultDiscountPercentExact: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>安全库存</Label>
              <Input
                inputMode="decimal"
                value={productDraft.safetyStockExact}
                onChange={(event) =>
                  setProductDraft((current) => ({
                    ...current,
                    safetyStockExact: event.target.value,
                  }))
                }
              />
            </div>
            <div className="wide">
              <Label>备注</Label>
              <Textarea
                value={productDraft.note}
                onChange={(event) =>
                  setProductDraft((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <Button
            size="lg"
            disabled={saving}
            onClick={() => void saveProduct()}
          >
            {saving ? '正在保存…' : '保存产品档案'}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={costProduct !== null}
        onOpenChange={(next) => !next && setCostProduct(null)}
      >
        <DialogContent className="inventory-dialog inventory-product-dialog">
          <DialogHeader>
            <DialogTitle>产品成本与售价管理</DialogTitle>
            <DialogDescription>
              仅老板可见和可修改。保存后会立即进入库存成本与毛利核算。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-blue-50 p-4">
            <strong className="text-lg">{costProduct?.name}</strong>
            <p className="text-slate-500">
              {costProduct?.category} · {costProduct?.barcode}
            </p>
          </div>
          <div className="inventory-form-grid">
            <div>
              <Label>进货成本（元）</Label>
              <Input
                inputMode="decimal"
                value={costDraft.purchaseCostExact}
                onChange={(event) =>
                  setCostDraft((current) => ({
                    ...current,
                    purchaseCostExact: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>零售价（元）</Label>
              <Input
                inputMode="decimal"
                value={costDraft.retailPriceExact}
                onChange={(event) =>
                  setCostDraft((current) => ({
                    ...current,
                    retailPriceExact: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>默认销售折扣（%）</Label>
              <Input
                inputMode="decimal"
                value={costDraft.defaultDiscountPercentExact}
                onChange={(event) =>
                  setCostDraft((current) => ({
                    ...current,
                    defaultDiscountPercentExact: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>供应商</Label>
              <Input
                value={costDraft.supplier}
                onChange={(event) =>
                  setCostDraft((current) => ({
                    ...current,
                    supplier: event.target.value,
                  }))
                }
              />
            </div>
            <div className="wide">
              <Label>成本备注</Label>
              <Textarea
                value={costDraft.note}
                onChange={(event) =>
                  setCostDraft((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                placeholder="可记录供应商报价、成本变更原因或生效日期"
              />
            </div>
          </div>
          <Button size="lg" disabled={saving} onClick={() => void saveCost()}>
            {saving ? '正在保存…' : '保存成本与售价'}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(actionMode)}
        onOpenChange={(next) => !next && setActionMode(null)}
      >
        <DialogContent className="inventory-dialog inventory-action-dialog">
          {actionMode && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {actionMode === 'inbound' && inboundEntryMethod === 'manual'
                    ? MANUAL_INBOUND_COPY.title
                    : ACTION_COPY[actionMode].title}
                </DialogTitle>
                <DialogDescription>
                  {actionMode === 'inbound' && inboundEntryMethod === 'manual'
                    ? MANUAL_INBOUND_COPY.description
                    : ACTION_COPY[actionMode].description}
                </DialogDescription>
              </DialogHeader>
              {actionMode === 'inbound' && inboundEntryMethod === 'scan' && (
                <div className="inventory-scan-box">
                  <div>
                    <Barcode />
                    <strong>先扫描产品条码</strong>
                    <span>已建档产品会自动识别，陌生条码会提示建档。</span>
                  </div>
                  <div className="inventory-inline-field">
                    <Input
                      value={movementDraft.barcode}
                      onChange={(event) =>
                        setMovementDraft((current) => ({
                          ...current,
                          barcode: event.target.value,
                        }))
                      }
                      onKeyDown={(event) =>
                        event.key === 'Enter' &&
                        resolveBarcode(movementDraft.barcode)
                      }
                      placeholder="扫码枪扫描后按回车"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setCameraOpen(true)}
                    >
                      <Camera /> 相机扫码
                    </Button>
                    <Button
                      onClick={() => resolveBarcode(movementDraft.barcode)}
                    >
                      识别
                    </Button>
                  </div>
                </div>
              )}
              {actionMode === 'inbound' && inboundEntryMethod === 'manual' && (
                <div className="inventory-manual-box">
                  <div>
                    <FilePenLine />
                    <strong>直接选择已有产品，或先新建产品档案</strong>
                    <span>没有条码也可以入库，系统会自动生成内部货号。</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setProductDraft(EMPTY_PRODUCT);
                      setProductDialogOpen(true);
                    }}
                  >
                    <PackagePlus /> 新建无条码产品
                  </Button>
                </div>
              )}
              <div className="inventory-form-grid">
                <div className="wide">
                  <Label>产品</Label>
                  <Select
                    value={movementDraft.productId}
                    onValueChange={(value) => {
                      const product = products.find(
                        (item) => item.id === value,
                      );
                      if (product) setMovementProduct(product);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择产品" />
                    </SelectTrigger>
                    <SelectContent>
                      {products
                        .filter((product) => product.status === 'active')
                        .map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} · 库存 {product.currentStockExact}{' '}
                            {product.unit}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedProduct && (
                    <p className="inventory-field-hint">
                      条码/内部货号 {selectedProduct.barcode} · 零售价{' '}
                      {money(selectedProduct.retailPriceExact)} · 当前库存{' '}
                      {selectedProduct.currentStockExact} {selectedProduct.unit}
                    </p>
                  )}
                </div>
                <div>
                  <Label>
                    {actionMode === 'inbound'
                      ? '入库数量'
                      : actionMode === 'internal_use'
                        ? '领用数量'
                        : '销售数量'}
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={movementDraft.quantityExact}
                    onChange={(event) =>
                      setMovementDraft((current) => ({
                        ...current,
                        quantityExact: event.target.value,
                      }))
                    }
                  />
                </div>
                {actionMode === 'inbound' && (
                  <>
                    {isOwner && (
                      <div>
                        <Label>本次进货单价（元）</Label>
                        <Input
                          inputMode="decimal"
                          value={movementDraft.unitCostExact}
                          onChange={(event) =>
                            setMovementDraft((current) => ({
                              ...current,
                              unitCostExact: event.target.value,
                            }))
                          }
                        />
                      </div>
                    )}
                    <div>
                      <Label>供应商</Label>
                      <Input
                        value={movementDraft.supplier}
                        onChange={(event) =>
                          setMovementDraft((current) => ({
                            ...current,
                            supplier: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>批次号</Label>
                      <Input
                        value={movementDraft.batchNo}
                        onChange={(event) =>
                          setMovementDraft((current) => ({
                            ...current,
                            batchNo: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>有效期</Label>
                      <Input
                        type="date"
                        value={movementDraft.expiresOn}
                        onChange={(event) =>
                          setMovementDraft((current) => ({
                            ...current,
                            expiresOn: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </>
                )}
                {actionMode === 'internal_use' && (
                  <>
                    <div>
                      <Label>领用人</Label>
                      <Input
                        value={movementDraft.recipientName}
                        onChange={(event) =>
                          setMovementDraft((current) => ({
                            ...current,
                            recipientName: event.target.value,
                          }))
                        }
                        placeholder="填写实际领用员工"
                      />
                    </div>
                    <div className="wide">
                      <Label>领用用途</Label>
                      <Input
                        value={movementDraft.purpose}
                        onChange={(event) =>
                          setMovementDraft((current) => ({
                            ...current,
                            purpose: event.target.value,
                          }))
                        }
                        placeholder="例如：护理房日常消耗 / 样品试用"
                      />
                    </div>
                    <div className="wide inventory-zero-income">
                      <ClipboardMinus />
                      <div>
                        <strong>本单收入 ¥0.00</strong>
                        <span>
                          内部领用只扣减库存，不计入客户消费和营业收入。
                        </span>
                      </div>
                    </div>
                  </>
                )}
                {actionMode === 'customer_sale' && (
                  <>
                    <div className="wide inventory-customer-field">
                      <Label>客户姓名</Label>
                      <Input
                        value={movementDraft.customerName}
                        onChange={(event) =>
                          setMovementDraft((current) => ({
                            ...current,
                            customerName: event.target.value,
                            customerAssetId: '',
                          }))
                        }
                        placeholder="输入姓名或手机号搜索客户资料库"
                      />
                      {customerResults.length > 0 && (
                        <div className="inventory-customer-results">
                          {customerResults.map((customer) => (
                            <button
                              type="button"
                              key={customer.id}
                              onClick={() => {
                                setMovementDraft((current) => ({
                                  ...current,
                                  customerAssetId: customer.id,
                                  customerName: customer.name,
                                }));
                                setCustomerResults([]);
                              }}
                            >
                              <span className="customer-name-membership-row">
                                <strong>{customer.name}</strong>
                                <CustomerMembershipBadge memberLevel={customer.memberLevel} compact />
                              </span>
                              <span>
                                {customer.mobile || '无手机号'} · 累计消费{' '}
                                {money(customer.totalSpendExact || '0')}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>销售折扣（%）</Label>
                      <Input
                        inputMode="decimal"
                        value={movementDraft.discountPercentExact}
                        onChange={(event) =>
                          setMovementDraft((current) => ({
                            ...current,
                            discountPercentExact: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="inventory-sale-total">
                      <span>客户应收</span>
                      <strong>{money(saleAmount)}</strong>
                      <small>零售价 × 数量 × 折扣，保存后形成销售流水</small>
                    </div>
                  </>
                )}
                <div className="wide">
                  <Label>备注</Label>
                  <Textarea
                    value={movementDraft.note}
                    onChange={(event) =>
                      setMovementDraft((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <Button
                size="lg"
                disabled={saving || !movementDraft.productId}
                onClick={() => void saveMovement()}
              >
                {saving
                  ? '正在保存流水…'
                  : actionMode === 'inbound' && inboundEntryMethod === 'manual'
                    ? MANUAL_INBOUND_COPY.submit
                    : ACTION_COPY[actionMode].submit}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <BarcodeCamera
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDetected={(barcode) => {
          if (productDialogOpen)
            setProductDraft((current) => ({ ...current, barcode }));
          else resolveBarcode(barcode);
        }}
      />
    </main>
  );
}
