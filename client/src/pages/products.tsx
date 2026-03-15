import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HelpButton } from "@/components/help-button";
import {
  Package, Plus, ExternalLink, Globe, Gamepad2, AppWindow, Smartphone,
  Code2, Pencil, Trash2, Loader2, Rocket, Wrench, CheckCircle2, PauseCircle,
} from "lucide-react";
import { useState } from "react";

interface Product {
  id: number;
  name: string;
  description: string;
  url: string;
  type: string;
  status: string;
  icon: string;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  website: { icon: Globe, label: "Website", color: "text-blue-400" },
  webapp: { icon: AppWindow, label: "Web App", color: "text-purple-400" },
  game: { icon: Gamepad2, label: "Game", color: "text-green-400" },
  mobile: { icon: Smartphone, label: "Mobile App", color: "text-orange-400" },
  api: { icon: Code2, label: "API / Service", color: "text-cyan-400" },
  other: { icon: Package, label: "Other", color: "text-gray-400" },
};

const STATUS_CONFIG: Record<string, { icon: any; label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  development: { icon: Wrench, label: "In Development", variant: "secondary" },
  beta: { icon: Rocket, label: "Beta", variant: "outline" },
  live: { icon: CheckCircle2, label: "Live", variant: "default" },
  paused: { icon: PauseCircle, label: "Paused", variant: "destructive" },
};

function ProductForm({ product, onSave, onCancel }: { product?: Product; onSave: (data: any) => void; onCancel: () => void }) {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [url, setUrl] = useState(product?.url || "");
  const [type, setType] = useState(product?.type || "website");
  const [status, setStatus] = useState(product?.status || "development");
  const [icon, setIcon] = useState(product?.icon || "📦");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Product emoji"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-16 text-center text-lg"
          data-testid="input-product-icon"
        />
        <Input
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
          data-testid="input-product-name"
        />
      </div>
      <Textarea
        placeholder="Brief description..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        data-testid="input-product-description"
      />
      <Input
        placeholder="URL (e.g. https://myproduct.example.com)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        data-testid="input-product-url"
      />
      <div className="flex gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="flex-1" data-testid="select-product-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="webapp">Web App</SelectItem>
            <SelectItem value="game">Game</SelectItem>
            <SelectItem value="mobile">Mobile App</SelectItem>
            <SelectItem value="api">API / Service</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="flex-1" data-testid="select-product-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="development">In Development</SelectItem>
            <SelectItem value="beta">Beta</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} data-testid="button-cancel-product">Cancel</Button>
        <Button size="sm" onClick={() => onSave({ name, description, url, type, status, icon })} disabled={!name.trim()} data-testid="button-save-product">
          {product ? "Update" : "Add Product"}
        </Button>
      </div>
    </div>
  );
}

export default function Products() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setEditingProduct(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  const liveProducts = products.filter(p => p.status === "live");
  const devProducts = products.filter(p => p.status !== "live");

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Products</h1>
          <Badge variant="outline" className="text-[10px]">{products.length}</Badge>
          <HelpButton title="Products" content="Manage your company's products — websites, apps, games, and services. Each product gets its own card with a direct link to access it. Products built by your AI agents will appear here." />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" data-testid="button-add-product">
              <Plus className="h-3.5 w-3.5" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Product</DialogTitle>
            </DialogHeader>
            <ProductForm
              onSave={(data) => createMutation.mutate(data)}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <Card className="p-10 text-center">
          <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-sm font-medium mb-1">No products yet</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Add your websites, apps, games, and services to track them in one place.
          </p>
          <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)} data-testid="button-add-first-product">
            <Plus className="h-3.5 w-3.5" /> Add Your First Product
          </Button>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Live Products */}
          {liveProducts.length > 0 && (
            <div>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Live Products</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {liveProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={() => setEditingProduct(product)}
                    onDelete={() => deleteMutation.mutate(product.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* In Development */}
          {devProducts.length > 0 && (
            <div>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {liveProducts.length > 0 ? "In Development" : "All Products"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {devProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={() => setEditingProduct(product)}
                    onDelete={() => deleteMutation.mutate(product.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <ProductForm
              product={editingProduct}
              onSave={(data) => updateMutation.mutate({ id: editingProduct.id, ...data })}
              onCancel={() => setEditingProduct(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductCard({ product, onEdit, onDelete }: { product: Product; onEdit: () => void; onDelete: () => void }) {
  const typeConfig = TYPE_CONFIG[product.type] || TYPE_CONFIG.other;
  const statusConfig = STATUS_CONFIG[product.status] || STATUS_CONFIG.development;
  const TypeIcon = typeConfig.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="p-4 group hover:border-primary/30 transition-colors" data-testid={`card-product-${product.id}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{product.icon}</span>
          <div>
            <h3 className="text-sm font-semibold leading-tight">{product.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <TypeIcon className={`h-3 w-3 ${typeConfig.color}`} />
              <span className="text-[10px] text-muted-foreground">{typeConfig.label}</span>
            </div>
          </div>
        </div>
        <Badge variant={statusConfig.variant} className="text-[9px] gap-1">
          <StatusIcon className="h-2.5 w-2.5" />
          {statusConfig.label}
        </Badge>
      </div>

      {product.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
      )}

      <div className="flex items-center justify-between">
        {product.url ? (
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            data-testid={`link-product-${product.id}`}
          >
            <ExternalLink className="h-3 w-3" />
            Open Product
          </a>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">No URL set</span>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit} data-testid={`button-edit-product-${product.id}`}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete} data-testid={`button-delete-product-${product.id}`}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
