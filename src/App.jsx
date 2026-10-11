import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  ShoppingBag, Search, ShoppingCart, X, Plus, Minus, ExternalLink,
  MessageCircle, ArrowLeft, Lock, Edit3, Trash2, Tag, Check, Image as ImageIcon,
  KeyRound, LogOut, Upload, Loader2, Settings, Sparkles, MapPin,
  ChevronRight, ChevronLeft, ZoomIn, Share2, ChevronDown, Eye, EyeOff
} from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = "okej62yk";
const CLOUDINARY_UPLOAD_PRESET = "preset_tiendadepan";

// EMAIL AUTORIZADO PARA ESTA TIENDA
const EMAIL_AUTORIZADO = "tiendadepan@guiaclic.com.ar";

function construirGaleria(prod) {
  if (!prod) return [];
  const fotosGenerales = (prod.imagenes && prod.imagenes.length > 0)
    ? prod.imagenes
    : (prod.imagen_url ? [prod.imagen_url] : []);
  const variantes = prod.variantes || [];

  const vistas = new Set();
  const galeria = [];

  fotosGenerales.forEach((url) => {
    if (url && !vistas.has(url)) {
      vistas.add(url);
      galeria.push({ url, variante: null });
    }
  });

  variantes.forEach((v) => {
    const url = v.imagen_asociada_url;
    if (url && !vistas.has(url)) {
      vistas.add(url);
      galeria.push({ url, variante: v });
    }
  });

  return galeria;
}

function tieneMousePreciso() {
  return typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export default function App() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloOfertas, setSoloOfertas] = useState(false);
  const [menuCategoriasAbierto, setMenuCategoriasAbierto] = useState(false);

  // Modal Detalle de Producto
  const [productoDetalle, setProductoDetalle] = useState(null);
  const [imagenActivaIndex, setImagenActivaIndex] = useState(0);
  const [imagenVarianteDirecta, setImagenVarianteDirecta] = useState(null);
  const [lightboxAbierto, setLightboxAbierto] = useState(false);
  const [imagenHoverZoom, setImagenHoverZoom] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  
  // Selectores de variantes para Panadería
  const [saborSel, setSaborSel] = useState('');
  const [detalleSel, setDetalleSel] = useState('');
  const [cantidadSel, setCantidadSel] = useState(1);

  // Configuración Negocio
  const [configNegocio, setConfigNegocio] = useState({
    id: null,
    nombre: 'TIENDA DE PAN',
    subtitulo: 'Panadería & Pastelería Artesanal - Venta Mayorista',
    logo_url: '/logo.jpg',
    whatsapp: '5491156988468',
    monto_minimo_envio: 5000,
    zonas_cobertura: 'Pilar, Garín, Malvinas Argentinas y José C. Paz'
  });
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  // Carrito y Toast
  const [carrito, setCarrito] = useState([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [toastMensaje, setToastMensaje] = useState('');
  const [animarCarrito, setAnimarCarrito] = useState(false);

  // Advertencia al recargar o salir si hay productos en el carrito
  useEffect(() => {
    const manejarAntesDeSalir = (e) => {
      if (carrito.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', manejarAntesDeSalir);
    return () => window.removeEventListener('beforeunload', manejarAntesDeSalir);
  }, [carrito]);

  // Modo Admin
  const [esAdmin, setEsAdmin] = useState(false);
  const [modalAdminAbierto, setModalAdminAbierto] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState('');
  const [cargandoAuth, setCargandoAuth] = useState(false);

  // Formulario Admin
  const [productoEditar, setProductoEditar] = useState(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [subiendoImagenVarIdx, setSubiendoImagenVarIdx] = useState(null);
  const [formProd, setFormProd] = useState({
    titulo: '',
    categoria: '',
    descripcion: '',
    precio: '',
    precio_oferta: '',
    imagenes: []
  });

  const [formVariantes, setFormVariantes] = useState([
    { sabor_presentacion: '', detalle: '', stock: 999, precio: '', precio_oferta: '', imagen_asociada_url: '' }
  ]);

  const GUIA_CLIC_URL = "https://guiaclic.com.ar";

  useEffect(() => {
    fetchProductos();
    fetchConfigNegocio();
    verificarSesion();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email === EMAIL_AUTORIZADO) {
        setEsAdmin(true);
      } else {
        if (session) await supabase.auth.signOut();
        setEsAdmin(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const linkCompartidoAplicadoRef = useRef(false);

  useEffect(() => {
    if (linkCompartidoAplicadoRef.current) return;
    if (!productos || productos.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const prodId = params.get('producto');
    if (!prodId) {
      linkCompartidoAplicadoRef.current = true;
      return;
    }

    const prod = productos.find((p) => String(p.id) === String(prodId));
    linkCompartidoAplicadoRef.current = true;
    if (!prod) return;

    abrirDetalleProducto(prod);

    const sabor = params.get('sabor') || '';
    const detalle = params.get('detalle') || '';

    if (sabor || detalle) {
      const variante = (prod.variantes || []).find((v) =>
        (sabor === '' || v.sabor_presentacion === sabor) &&
        (detalle === '' || v.detalle === detalle)
      );
      if (variante) {
        setSaborSel(variante.sabor_presentacion || '');
        setDetalleSel(variante.detalle || '');
        if (variante.imagen_asociada_url) {
          const galeria = construirGaleria(prod);
          const idx = galeria.findIndex((g) => g.url === variante.imagen_asociada_url);
          if (idx >= 0) setImagenActivaIndex(idx);
        }
      }
    }
  }, [productos]);

  const touchStartXRef = useRef(null);
  const lightboxImgRef = useRef(null);
  const arrastreZoomRef = useRef({ inicio: null, panInicial: { x: 0, y: 0 }, arrastro: false, esHorizontal: null });
  const [panZoom, setPanZoom] = useState({ x: 0, y: 0 });
  const panZoomRef = useRef(panZoom);
  useEffect(() => { panZoomRef.current = panZoom; }, [panZoom]);

  useEffect(() => {
    if (!lightboxAbierto) return;
    const el = lightboxImgRef.current;
    if (!el || tieneMousePreciso()) return;

    const handleTouchStart = (e) => {
      const t = e.touches[0];
      arrastreZoomRef.current = {
        inicio: { x: t.clientX, y: t.clientY },
        panInicial: { ...panZoomRef.current },
        arrastro: false,
        esHorizontal: null,
      };
    };

    const handleTouchMove = (e) => {
      const estado = arrastreZoomRef.current;
      if (!estado.inicio) return;
      const t = e.touches[0];
      const dx = t.clientX - estado.inicio.x;
      const dy = t.clientY - estado.inicio.y;

      if (estado.esHorizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        estado.esHorizontal = Math.abs(dx) > Math.abs(dy);
      }

      if (imagenHoverZoom) {
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) estado.arrastro = true;
        if (estado.arrastro) {
          e.preventDefault();
          const rect = el.getBoundingClientRect();
          const limiteX = rect.width * 0.65;
          const limiteY = rect.height * 0.65;
          const nuevoX = Math.min(limiteX, Math.max(-limiteX, estado.panInicial.x + dx));
          const nuevoY = Math.min(limiteY, Math.max(-limiteY, estado.panInicial.y + dy));
          setPanZoom({ x: nuevoX, y: nuevoY });
        }
      } else if (estado.esHorizontal) {
        if (Math.abs(dx) > 4) estado.arrastro = true;
        e.preventDefault();
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, [lightboxAbierto, imagenHoverZoom]);

  useEffect(() => {
    if (!productoDetalle) return;

    const galeria = construirGaleria(productoDetalle);
    if (galeria.length <= 1) return;

    const irAIndice = (calcularNuevoIndice) => {
      setImagenVarianteDirecta(null);
      setImagenActivaIndex((prev) => {
        const nuevoIndex = calcularNuevoIndice(prev, galeria.length);
        const item = galeria[nuevoIndex];
        if (item?.variante) {
          setSaborSel(item.variante.sabor_presentacion || '');
          setDetalleSel(item.variante.detalle || '');
        }
        return nuevoIndex;
      });
    };

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        irAIndice((prev, total) => (prev + 1) % total);
      } else if (e.key === 'ArrowLeft') {
        irAIndice((prev, total) => (prev - 1 + total) % total);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productoDetalle]);

  const mostrarToast = (mensaje) => {
    setToastMensaje(mensaje);
    setAnimarCarrito(true);
    setTimeout(() => setAnimarCarrito(false), 600);
    setTimeout(() => setToastMensaje(''), 3000);
  };

  const mostrarToastSimple = (mensaje) => {
    setToastMensaje(mensaje);
    setTimeout(() => setToastMensaje(''), 3000);
  };

  const compartirProducto = async () => {
    if (!productoDetalle) return;

    const params = new URLSearchParams();
    params.set('producto', productoDetalle.id);
    if (saborSel) params.set('sabor', saborSel);
    if (detalleSel) params.set('detalle', detalleSel);

    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    const detalleVariante = [saborSel, detalleSel].filter(Boolean).join(' / ');
    const titulo = `${productoDetalle.titulo}${detalleVariante ? ' - ' + detalleVariante : ''}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, url });
      } catch (error) {}
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      mostrarToastSimple('¡Link copiado!');
    } catch (error) {
      mostrarToastSimple('No se pudo copiar el link');
    }
  };

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email === EMAIL_AUTORIZADO) {
      setEsAdmin(true);
    } else {
      if (session) await supabase.auth.signOut();
      setEsAdmin(false);
    }
  }

  async function fetchProductos() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tienda_de_pan_productos')
        .select(`
          *,
          variantes:tienda_de_pan_variantes(*)
        `)
        .order('id', { ascending: false });

      if (error) throw error;
      setProductos(data || []);
    } catch (error) {
      console.error('Error cargando productos:', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConfigNegocio() {
    try {
      const { data, error } = await supabase
        .from('tienda_de_pan_config')
        .select('*')
        .limit(1)
        .single();

      if (data) {
        setConfigNegocio((prev) => ({
          ...data,
          logo_url: data.logo_url || prev.logo_url
        }));
      }
    } catch (error) {
      console.error('Error cargando datos del negocio:', error.message);
    }
  }

  const handleSubirImagen = async (e, esLogo = false, esVarianteIndex = null) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    try {
      if (esLogo) setSubiendoLogo(true);
      else if (esVarianteIndex !== null) setSubiendoImagenVarIdx(esVarianteIndex);
      else setSubiendoImagen(true);

      const urlsSubidas = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (data.secure_url) {
          urlsSubidas.push(data.secure_url);
        } else {
          throw new Error(data.error?.message || 'Error al subir la imagen');
        }
      }

      if (esLogo) {
        setConfigNegocio((prev) => ({ ...prev, logo_url: urlsSubidas[0] }));
      } else if (esVarianteIndex !== null) {
        setFormVariantes((prev) => {
          const copia = [...prev];
          copia[esVarianteIndex].imagen_asociada_url = urlsSubidas[0];
          return copia;
        });
      } else {
        setFormProd((prev) => ({
          ...prev,
          imagenes: [...prev.imagenes, ...urlsSubidas]
        }));
      }
    } catch (error) {
      alert('Error al subir la imagen: ' + error.message);
    } finally {
      if (esLogo) setSubiendoLogo(false);
      else if (esVarianteIndex !== null) setSubiendoImagenVarIdx(null);
      else setSubiendoImagen(false);
    }
  };

  const guardarConfigNegocio = async (e) => {
    e.preventDefault();
    try {
      if (configNegocio.id) {
        const { error } = await supabase
          .from('tienda_de_pan_config')
          .update({
            nombre: configNegocio.nombre,
            subtitulo: configNegocio.subtitulo,
            logo_url: configNegocio.logo_url,
            whatsapp: configNegocio.whatsapp,
            monto_minimo_envio: configNegocio.monto_minimo_envio,
            zonas_cobertura: configNegocio.zonas_cobertura
          })
          .eq('id', configNegocio.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('tienda_de_pan_config')
          .insert([{
            nombre: configNegocio.nombre,
            subtitulo: configNegocio.subtitulo,
            logo_url: configNegocio.logo_url,
            whatsapp: configNegocio.whatsapp,
            monto_minimo_envio: configNegocio.monto_minimo_envio,
            zonas_cobertura: configNegocio.zonas_cobertura
          }])
          .select()
          .single();
        if (error) throw error;
        if (data) setConfigNegocio(data);
      }
      alert('¡Configuración guardada!');
    } catch (error) {
      alert('Error al guardar datos del negocio: ' + error.message);
    }
  };

  const handleLoginAdmin = async (e) => {
    e.preventDefault();
    setErrorPassword('');
    setCargandoAuth(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput,
      });

      if (error) throw error;

      if (data.user?.email !== EMAIL_AUTORIZADO) {
        await supabase.auth.signOut();
        setErrorPassword('Usuario incorrecto.');
        return;
      }

      setEsAdmin(true);
      setModalAdminAbierto(false);
      setEmailInput('');
      setPasswordInput('');
    } catch (error) {
      setErrorPassword('Email o contraseña incorrectos.');
    } finally {
      setCargandoAuth(false);
    }
  };

  const handleLogoutAdmin = async () => {
    await supabase.auth.signOut();
    setEsAdmin(false);
  };

  const abrirDetalleProducto = (prod) => {
    setProductoDetalle(prod);
    setCantidadSel(1);
    setLightboxAbierto(false);
    setImagenHoverZoom(false);

    const vars = prod.variantes || [];
    const galeria = construirGaleria(prod);

    if (vars.length > 0) {
      setSaborSel(vars[0].sabor_presentacion || '');
      setDetalleSel(vars[0].detalle || '');
      const idxInicial = vars[0].imagen_asociada_url
        ? galeria.findIndex((g) => g.url === vars[0].imagen_asociada_url)
        : -1;
      setImagenActivaIndex(idxInicial >= 0 ? idxInicial : 0);
    } else {
      setSaborSel('');
      setDetalleSel('');
      setImagenActivaIndex(0);
    }
  };

  const obtenerVarianteSeleccionada = () => {
    if (!productoDetalle || !productoDetalle.variantes || productoDetalle.variantes.length === 0) return null;
    return productoDetalle.variantes.find((v) =>
      (saborSel === '' || v.sabor_presentacion === saborSel) &&
      (detalleSel === '' || v.detalle === detalleSel)
    ) || null;
  };

  const varianteActual = obtenerVarianteSeleccionada();

  const handleCambioVariante = (tipo, valor) => {
    const variantes = productoDetalle?.variantes || [];

    let sab = saborSel;
    let det = detalleSel;

    if (tipo === 'sabor') sab = valor;
    if (tipo === 'detalle') det = valor;

    const candidatas = variantes.filter((v) => {
      if (tipo === 'sabor') return v.sabor_presentacion === valor;
      return v.detalle === valor;
    });

    const combinacionValida = candidatas.some((v) =>
      (sab === '' || v.sabor_presentacion === sab) &&
      (det === '' || v.detalle === det)
    );

    if (!combinacionValida && candidatas[0]) {
      sab = candidatas[0].sabor_presentacion || '';
      det = candidatas[0].detalle || '';
    }

    setSaborSel(sab);
    setDetalleSel(det);

    const encontrada = variantes.find((v) =>
      (sab === '' || v.sabor_presentacion === sab) &&
      (det === '' || v.detalle === det)
    ) || candidatas[0] || null;

    setImagenVarianteDirecta(encontrada?.imagen_asociada_url || null);
  };

  const tieneVariantes = (productoDetalle?.variantes || []).length > 0;

  const obtenerPrecioActual = () => {
    if (varianteActual) {
      const pOferta = varianteActual.precio_oferta ? Number(varianteActual.precio_oferta) : null;
      const pNormal = varianteActual.precio ? Number(varianteActual.precio) : Number(productoDetalle?.precio_base || 0);
      return {
        precio: pOferta || pNormal,
        precioOriginal: pOferta ? pNormal : null,
        stock: varianteActual.stock ?? 999
      };
    }
    if (tieneVariantes) {
      const pOferta = productoDetalle?.precio_oferta ? Number(productoDetalle.precio_oferta) : null;
      const pNormal = Number(productoDetalle?.precio_base || 0);
      return {
        precio: pOferta || pNormal,
        precioOriginal: pOferta ? pNormal : null,
        stock: 0
      };
    }
    const pOferta = productoDetalle?.precio_oferta ? Number(productoDetalle.precio_oferta) : null;
    const pNormal = Number(productoDetalle?.precio_base || 0);
    return {
      precio: pOferta || pNormal,
      precioOriginal: pOferta ? pNormal : null,
      stock: 999
    };
  };

  const agregarAlCarritoDesdeDetalle = () => {
    if (!productoDetalle) return;

    if (tieneVariantes && !varianteActual) {
      alert('Esa combinación no está disponible. Elegí otra opción.');
      return;
    }

    const infoPrecio = obtenerPrecioActual();

    const imgFinal = imagenVarianteDirecta ||
      (productoDetalle.imagenes && productoDetalle.imagenes[0]) ||
      productoDetalle.imagen_url || '';

    const varianteKey = varianteActual ? varianteActual.id : 'base';

    const itemCarrito = {
      id: `${productoDetalle.id}_${varianteKey}`,
      producto_id: productoDetalle.id,
      variante_id: varianteActual?.id || null,
      titulo: productoDetalle.titulo,
      sabor_presentacion: saborSel,
      detalle: detalleSel,
      precioEfectivo: infoPrecio.precio,
      cantidad: cantidadSel,
      imagen: imgFinal
    };

    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === itemCarrito.id);
      if (existe) {
        return prev.map((item) =>
          item.id === itemCarrito.id ? { ...item, cantidad: item.cantidad + cantidadSel } : item
        );
      }
      return [...prev, itemCarrito];
    });

    setProductoDetalle(null);
    mostrarToast(`¡"${productoDetalle.titulo}" agregado al carrito!`);
  };

  const modificarCantidad = (id, delta) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nuevaCant = item.cantidad + delta;
            return nuevaCant > 0 ? { ...item, cantidad: nuevaCant } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const vaciarCarrito = () => {
    if (carrito.length === 0) return;
    if (!confirm('¿Vaciar todo el carrito?')) return;
    setCarrito([]);
  };

  const totalCarrito = carrito.reduce((sum, item) => sum + item.precioEfectivo * item.cantidad, 0);
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  const MINIMO_ENVIO = Number(configNegocio.monto_minimo_envio || 5000);
  const cumpleMinimo = totalCarrito >= MINIMO_ENVIO;

  const enviarPedidoWhatsApp = () => {
    if (carrito.length === 0 || !cumpleMinimo) return;
    let mensaje = `Hola *${configNegocio.nombre}*! Quisiera realizar el siguiente pedido mayorista:\n\n`;
    carrito.forEach((item) => {
      let detalles = [];
      if (item.sabor_presentacion) detalles.push(`Opción: ${item.sabor_presentacion}`);
      if (item.detalle) detalles.push(`Detalle: ${item.detalle}`);

      const strDetalles = detalles.length > 0 ? ` (${detalles.join(', ')})` : '';
      mensaje += `• *${item.titulo}*${strDetalles} x${item.cantidad} - $${item.precioEfectivo * item.cantidad}\n`;
    });
    mensaje += `\n*TOTAL ESTIMADO: $${totalCarrito}*`;
    mensaje += `\n\n----------------------------------`;
    mensaje += `\n📍 *Dirección de entrega:* [Escribí tu calle y localidad aquí]`;

    const wsNumber = configNegocio.whatsapp || "5491156988468";
    window.open(`https://wa.me/${wsNumber}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const normalizarCategoria = (valorIngresado) => {
    const limpio = (valorIngresado || '').trim();
    if (!limpio) return '';
    const existente = categorias.find((c) => c.toLowerCase() === limpio.toLowerCase());
    if (existente) return existente;
    return limpio.charAt(0).toUpperCase() + limpio.slice(1);
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        titulo: formProd.titulo,
        categoria: normalizarCategoria(formProd.categoria),
        descripcion: formProd.descripcion,
        precio_base: Number(formProd.precio) || 0,
        precio_oferta: formProd.precio_oferta ? Number(formProd.precio_oferta) : null,
        imagenes: formProd.imagenes,
        imagen_url: formProd.imagenes[0] || ''
      };

      let prodId = productoEditar?.id;

      if (productoEditar) {
        const { error } = await supabase
          .from('tienda_de_pan_productos')
          .update(payload)
          .eq('id', prodId);
        if (error) throw error;

        await supabase.from('tienda_de_pan_variantes').delete().eq('producto_id', prodId);
      } else {
        const { data, error } = await supabase
          .from('tienda_de_pan_productos')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        prodId = data.id;
      }

      if (formVariantes.length > 0 && prodId) {
        const variantesPayload = formVariantes
          .filter((v) => v.sabor_presentacion || v.detalle)
          .map((v) => ({
            producto_id: prodId,
            sabor_presentacion: v.sabor_presentacion,
            detalle: v.detalle,
            stock: Number(v.stock) || 999,
            precio: v.precio ? Number(v.precio) : null,
            precio_oferta: v.precio_oferta ? Number(v.precio_oferta) : null,
            imagen_asociada_url: v.imagen_asociada_url || null
          }));

        if (variantesPayload.length > 0) {
          const { error: errVar } = await supabase
            .from('tienda_de_pan_variantes')
            .insert(variantesPayload);
          if (errVar) throw errVar;
        }
      }

      setFormProd({ titulo: '', categoria: '', descripcion: '', precio: '', precio_oferta: '', imagenes: [] });
      setFormVariantes([{ sabor_presentacion: '', detalle: '', stock: 999, precio: '', precio_oferta: '', imagen_asociada_url: '' }]);
      setProductoEditar(null);
      fetchProductos();
      alert('¡Producto y variantes guardados correctamente!');
    } catch (err) {
      alert('Error al guardar el producto: ' + err.message);
    }
  };

  const editarProducto = (prod, e) => {
    if (e) e.stopPropagation();
    setProductoEditar(prod);
    const imgs = prod.imagenes && prod.imagenes.length > 0 ? prod.imagenes : (prod.imagen_url ? [prod.imagen_url] : []);
    setFormProd({
      titulo: prod.titulo || '',
      categoria: prod.categoria || '',
      descripcion: prod.descripcion || '',
      precio: prod.precio_base || '',
      precio_oferta: prod.precio_oferta || '',
      imagenes: imgs
    });

    if (prod.variantes && prod.variantes.length > 0) {
      setFormVariantes(prod.variantes.map((v) => ({
        sabor_presentacion: v.sabor_presentacion || '',
        detalle: v.detalle || '',
        stock: v.stock ?? 999,
        precio: v.precio || '',
        precio_oferta: v.precio_oferta || '',
        imagen_asociada_url: v.imagen_asociada_url || ''
      })));
    } else {
      setFormVariantes([{ sabor_presentacion: '', detalle: '', stock: 999, precio: '', precio_oferta: '', imagen_asociada_url: '' }]);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminarProducto = async (id, e) => {
    if (e) e.stopPropagation();
    if (!confirm('¿Seguro que querés eliminar este producto?')) return;
    try {
      const { error } = await supabase.from('tienda_de_pan_productos').delete().eq('id', id);
      if (error) throw error;
      fetchProductos();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const categorias = [...new Map(
    productos
      .map((p) => (p?.categoria || '').trim())
      .filter(Boolean)
      .map((cat) => [cat.toLowerCase(), cat])
  ).values()];

  const obtenerImagenCategoria = (cat) => {
    const prod = productos.find(
      (p) => (p.categoria || '').trim().toLowerCase() === cat.trim().toLowerCase() &&
      ((p.imagenes && p.imagenes[0]) || p.imagen_url)
    );
    return (prod?.imagenes && prod?.imagenes[0]) || prod?.imagen_url || '/logo.jpg';
  };

  const productosFiltrados = productos.filter((p) => {
    const titulo = (p?.titulo || '').toLowerCase();
    const query = busqueda.toLowerCase();
    const coincideCategoria =
      !categoriaSeleccionada ||
      (p?.categoria || '').trim().toLowerCase() === categoriaSeleccionada.trim().toLowerCase();
    const coincideBusqueda = titulo.includes(query);
    const coincideOferta = !soloOfertas || (p?.precio_oferta && Number(p.precio_oferta) > 0);
    return coincideCategoria && coincideBusqueda && coincideOferta;
  });

  const saboresExistentes = [...new Set(
    productos.flatMap((p) => (p.variantes || []).map((v) => (v.sabor_presentacion || '').trim())).filter(Boolean)
  )].sort();

  return (
    <div className="min-h-screen bg-amber-50/30 text-zinc-900 flex flex-col justify-between font-sans antialiased">
      <div>
        {/* Banner Superior Informativo de Envíos */}
        <div className="bg-amber-950 text-amber-300 text-sm sm:text-sm py-2.5 px-4 font-bold text-center flex justify-center items-center gap-2 border-b border-amber-500/30">
          <span>🚚 ENVÍOS A DOMICILIO (Mínimo ${configNegocio.monto_minimo_envio || 5000}): {configNegocio.zonas_cobertura}</span>
        </div>

        {/* HEADER PRINCIPAL */}
        <header className="bg-amber-900 text-white sticky top-0 z-30 shadow-xl border-b border-amber-600/30">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">

        {/* LOGO + NOMBRE DISPUESTOS EN VERTICAL */}
        <div
          className="flex flex-col items-center sm:items-start gap-1 cursor-pointer"
          onClick={() => { setCategoriaSeleccionada(null); setBusqueda(''); setSoloOfertas(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <img
            src={configNegocio.logo_url || '/logo.jpg'}
            alt={configNegocio.nombre}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover shadow-lg border-2 border-amber-300"
          />
          <div className="text-center sm:text-left mt-1">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-white">
              {configNegocio.nombre}
            </h1>
            <span className="text-xs sm:text-sm text-amber-300 tracking-wider uppercase font-bold block mt-1">
              {configNegocio.subtitulo}
            </span>
          </div>
        </div>

            {/* BUSCADOR DESKTOP */}
            <div className="flex-1 max-w-lg hidden md:block">
              <div className="relative">
                <input
                  type="text"
                  placeholder="¿Qué producto querés pedir?"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-5 pr-12 py-3 rounded-full text-zinc-900 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-inner bg-white"
                />
                <Search className="absolute right-4 top-3.5 w-5 h-5 text-zinc-400" />
              </div>
            </div>

            {/* BOTONES ACCIÓN */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCarritoAbierto(true)}
                className={`relative p-3 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black rounded-full transition-all duration-300 flex items-center gap-2 px-5 shadow-lg ${
                  animarCarrito ? 'scale-110 bg-amber-200 ring-4 ring-amber-100' : ''
                }`}
              >
                <ShoppingCart className="w-6 h-6" />
                <span className="text-sm font-black hidden sm:inline uppercase tracking-wider">Pedido</span>
                {totalItems > 0 && (
                  <span className={`bg-amber-950 text-amber-300 text-sm font-black w-6 h-6 rounded-full flex items-center justify-center shadow transition-transform duration-300 ${
                    animarCarrito ? 'scale-150' : 'scale-100'
                  }`}>
                    {totalItems}
                  </span>
                )}
              </button>

              <button
                onClick={() => esAdmin ? handleLogoutAdmin() : setModalAdminAbierto(true)}
                className={`p-3 rounded-full transition-colors ${esAdmin ? 'bg-amber-300 text-amber-950' : 'hover:bg-amber-800 text-amber-200'}`}
                title={esAdmin ? 'Cerrar Sesión Admin' : 'Ingresar como Admin'}
              >
                {esAdmin ? <LogOut className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Navegación Principal */}
          <nav className="bg-stone-900 border-b border-amber-900/40 text-stone-200">
            <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-base font-semibold h-14 relative">
              <div className="flex items-center gap-2 overflow-x-visible">
                
                {/* 1. INICIO */}
                <button
                  onClick={() => {
                    setCategoriaSeleccionada(null);
                    setSoloOfertas(false);
                    setBusqueda('');
                    setMenuCategoriasAbierto(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`px-4 py-2.5 text-base rounded-md transition-colors ${
                    !categoriaSeleccionada && !soloOfertas
                      ? 'text-amber-400 bg-stone-800 font-bold'
                      : 'hover:text-amber-300 hover:bg-stone-800/50'
                  }`}
                >
                  Inicio
                </button>

                {/* 3. CATEGORÍAS (Desplegable) */}
                <div className="relative">
                  <button
                    onClick={() => setMenuCategoriasAbierto(!menuCategoriasAbierto)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-base rounded-md transition-colors ${
                      categoriaSeleccionada
                        ? 'text-amber-400 bg-stone-800 font-bold'
                        : 'hover:text-amber-300 hover:bg-stone-800/50'
                    }`}
                  >
                    Categorías
                    <ChevronDown className={`w-4 h-4 transition-transform ${menuCategoriasAbierto ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Menú Desplegable (Dropdown) */}
                  {menuCategoriasAbierto && (
                    <>
                      {/* Backdrop para cerrar al hacer clic afuera */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuCategoriasAbierto(false)}
                      />

                      <div className="absolute top-full left-0 mt-1 w-56 bg-stone-900 border border-stone-700 rounded-lg shadow-2xl py-2 z-50 divide-y divide-stone-800">
                        <button
                          onClick={() => {
                            setCategoriaSeleccionada(null);
                            setSoloOfertas(false);
                            setMenuCategoriasAbierto(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-base font-bold uppercase tracking-wider transition-colors ${
                            !categoriaSeleccionada ? 'text-amber-400 bg-stone-800' : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                          }`}
                        >
                          Todas las categorías
                        </button>

                        <div className="py-1">
                          {categorias.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => {
                                setCategoriaSeleccionada(cat);
                                setSoloOfertas(false);
                                setMenuCategoriasAbierto(false);
                              }}
                              className={`w-full text-left px-4 py-2 text-base font-semibold transition-colors ${
                                categoriaSeleccionada === cat
                                  ? 'text-amber-400 bg-stone-800 font-bold'
                                  : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 4. CONTACTO */}
                <button
                  onClick={() => {
                    setMenuCategoriasAbierto(false);
                    const footerElement = document.getElementById('footer');
                    if (footerElement) {
                      footerElement.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }
                  }}
                  className="px-4 py-2.5 text-base rounded-md hover:text-amber-300 hover:bg-stone-800/50 transition-colors"
                >
                  Contacto
                </button>

              </div>
            </div>
          </nav>
        </header>

        {/* Buscador Mobile */}
        <div className="md:hidden p-3 bg-white border-b border-amber-200 shadow-sm">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar panes, facturas, budines..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-amber-50/50 text-base font-medium focus:outline-none focus:bg-white border border-amber-200"
            />
            <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-amber-400" />
          </div>
        </div>

        {/* BANNER PORTADA */}
        {!categoriaSeleccionada && !busqueda && !soloOfertas && (
          <section className="relative w-full min-h-[420px] sm:min-h-[520px] lg:min-h-[580px] flex items-center justify-center bg-amber-950 overflow-hidden border-b border-amber-700/30">
            <img
              src={(productos[0]?.imagenes && productos[0]?.imagenes[0]) || productos[0]?.imagen_url || configNegocio.logo_url}
              alt="Banner Principal Panadería"
              className="absolute inset-0 w-full h-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-amber-950 via-amber-950/60 to-transparent" />

            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-12 text-center md:text-left flex flex-col items-center md:items-start space-y-6">
              <span className="bg-amber-400 text-amber-950 text-sm sm:text-sm font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> VENTA MAYORISTA & REPARTO
              </span>

              <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight leading-none text-white max-w-4xl drop-shadow-md">
                PANADERÍA Y PASTELERÍA ARTESANAL
              </h2>

              <p className="text-amber-100 text-base sm:text-xl lg:text-2xl font-medium leading-relaxed max-w-2xl drop-shadow">
                Hacé tu pedido online y te lo llevamos directamente a tu negocio o domicilio.
              </p>

              <div className="pt-2">
                <button
                  onClick={() => setSoloOfertas(true)}
                  className="bg-amber-400 hover:bg-amber-300 text-amber-950 px-8 py-4 rounded-2xl font-black text-sm sm:text-lg uppercase tracking-wider shadow-2xl transition-transform hover:scale-105 border-2 border-amber-300"
                >
                  VER PROMOCIONES DESTACADAS
                </button>
              </div>
            </div>
          </section>
        )}

        {/* PANEL ADMIN */}
        {esAdmin && (
          <section className="bg-amber-900 text-white border-2 border-amber-500/40 p-6 max-w-7xl mx-auto my-6 rounded-2xl shadow-xl space-y-6">
            <div className="flex justify-between items-center pb-2 border-b border-amber-800">
              <div className="flex items-center gap-2 text-amber-300 font-black text-lg sm:text-xl uppercase tracking-wide">
                <KeyRound className="w-6 h-6 text-amber-300" /> Panel de Administración
              </div>
              <button
                onClick={handleLogoutAdmin}
                className="text-sm font-bold bg-amber-950 hover:bg-amber-800 px-3.5 py-1.5 rounded-lg text-amber-300 flex items-center gap-1 border border-amber-800"
              >
                <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
              </button>
            </div>

                        {/* CONFIGURACIÓN NEGOCIO */}
            <form onSubmit={guardarConfigNegocio} className="bg-amber-950 p-5 rounded-xl border border-amber-800 space-y-4 shadow-sm">
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Settings className="w-4 h-4" /> Configuración de la Panadería
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                
                {/* CAMPO AGREGADO: SUBIDA Y VISTA PREVIA DEL LOGO */}
                <div className="sm:col-span-3 pb-2 border-b border-amber-800/60">
                  <label className="text-sm font-bold text-amber-200 block mb-2">Logo del Comercio</label>
                  <div className="flex items-center gap-4">
                    <img
                      src={configNegocio.logo_url || '/logo.jpg'}
                      alt="Logo actual"
                      className="w-16 h-16 rounded-full object-cover border-2 border-amber-400 shadow-md"
                    />
                    <label className="cursor-pointer bg-amber-400 hover:bg-amber-300 text-amber-950 text-sm font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 shadow transition-colors">
                      {subiendoLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span>{subiendoLogo ? 'Subiendo...' : '📷 Subir nuevo logo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSubirImagen(e, true)}
                        disabled={subiendoLogo}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-amber-200 block mb-1">Nombre del Negocio</label>
                  <input
                    type="text"
                    required
                    value={configNegocio.nombre}
                    onChange={(e) => setConfigNegocio({ ...configNegocio, nombre: e.target.value })}
                    className="w-full p-2.5 bg-amber-900 border border-amber-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-amber-200 block mb-1">Subtítulo / Rubro</label>
                  <input
                    type="text"
                    required
                    value={configNegocio.subtitulo}
                    onChange={(e) => setConfigNegocio({ ...configNegocio, subtitulo: e.target.value })}
                    className="w-full p-2.5 bg-amber-900 border border-amber-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-amber-200 block mb-1">WhatsApp de Pedidos</label>
                  <input
                    type="text"
                    required
                    value={configNegocio.whatsapp}
                    onChange={(e) => setConfigNegocio({ ...configNegocio, whatsapp: e.target.value })}
                    className="w-full p-2.5 bg-amber-900 border border-amber-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-amber-200 block mb-1">Monto Mínimo de Envío ($)</label>
                  <input
                    type="number"
                    required
                    value={configNegocio.monto_minimo_envio}
                    onChange={(e) => setConfigNegocio({ ...configNegocio, monto_minimo_envio: e.target.value })}
                    className="w-full p-2.5 bg-amber-900 border border-amber-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-sm font-bold text-amber-200 block mb-1">Zonas de Cobertura</label>
                  <input
                    type="text"
                    required
                    value={configNegocio.zonas_cobertura}
                    onChange={(e) => setConfigNegocio({ ...configNegocio, zonas_cobertura: e.target.value })}
                    className="w-full p-2.5 bg-amber-900 border border-amber-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-sm uppercase tracking-wider px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow"
              >
                <Check className="w-4 h-4" /> Guardar Configuración
              </button>
            </form>

            {/* CARGA PRODUCTOS */}
            <form onSubmit={guardarProducto} className="bg-amber-950 p-5 rounded-xl border border-amber-800 space-y-6 shadow-sm text-amber-100">
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-amber-300">
                {productoEditar ? '✏️ Modificar Producto' : '➕ PUBLICAR NUEVO PRODUCTO'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-bold block mb-1">Título / Nombre</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Budín Artesanal"
                    value={formProd.titulo}
                    onChange={(e) => setFormProd({ ...formProd, titulo: e.target.value })}
                    className="w-full p-2.5 bg-amber-900 border border-amber-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold block mb-1">Categoría</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Budines, Facturas, Panes, Tartas..."
                    value={formProd.categoria}
                    onChange={(e) => setFormProd({ ...formProd, categoria: e.target.value })}
                    className="w-full p-2.5 bg-amber-900 border border-amber-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold block mb-1">Precio Base ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="2500"
                    value={formProd.precio}
                    onChange={(e) => setFormProd({ ...formProd, precio: e.target.value })}
                    className="w-full p-2.5 bg-amber-900 border border-amber-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-rose-300 block mb-1">Precio Oferta ($ - Opcional)</label>
                  <input
                    type="number"
                    placeholder="Opcional"
                    value={formProd.precio_oferta}
                    onChange={(e) => setFormProd({ ...formProd, precio_oferta: e.target.value })}
                    className="w-full p-2.5 bg-amber-900 border border-rose-900/60 rounded-lg text-sm text-white focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-sm font-bold block mb-1">Fotos del Producto</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="cursor-pointer bg-amber-400 hover:bg-amber-300 text-amber-950 text-sm font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 shadow transition-colors">
                      {subiendoImagen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {subiendoImagen ? 'Subiendo...' : '📷 Agregar Fotos'}
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleSubirImagen(e, false)}
                        disabled={subiendoImagen}
                        className="hidden"
                      />
                    </label>

                    {formProd.imagenes.map((url, idx) => (
                      <div key={idx} className="relative group w-10 h-10 border border-amber-700 rounded-lg overflow-hidden">
                        <img src={url} alt="Cargada" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormProd(prev => ({ ...prev, imagenes: prev.imagenes.filter((_, i) => i !== idx) }))}
                          className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-sm font-bold block mb-1">Descripción</label>
                  <textarea
                    rows={2}
                    placeholder="Descripción, ingredientes, peso aproximado o presentación..."
                    value={formProd.descripcion}
                    onChange={(e) => setFormProd({ ...formProd, descripcion: e.target.value })}
                    className="w-full p-2.5 bg-amber-900 border border-amber-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* VARIANTES PARA PANADERÍA */}
              <div className="border-t border-amber-800 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="text-sm font-extrabold uppercase tracking-wider text-amber-200">
                    Variantes (Sabor / Presentación / Precio)
                  </h5>
                  <button
                    type="button"
                    onClick={() => setFormVariantes(prev => [...prev, { sabor_presentacion: '', detalle: '', stock: 999, precio: '', precio_oferta: '', imagen_asociada_url: '' }])}
                    className="text-sm font-bold bg-amber-400 text-amber-950 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-amber-300"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Variante
                  </button>
                </div>

                <datalist id="datalist-sabores">
                  {saboresExistentes.map((s) => <option key={s} value={s} />)}
                </datalist>

                {formVariantes.map((v, idx) => (
                  <div key={idx} className="bg-amber-900 p-3 rounded-xl border border-amber-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-center">
                    <div>
                      <label className="text-xs font-bold text-amber-300 block mb-1">Sabor / Presentación</label>
                      <input
                        type="text"
                        list="datalist-sabores"
                        placeholder="Ej: Limón glaseado / Por Kilo"
                        value={v.sabor_presentacion}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, sabor_presentacion: val } : item));
                        }}
                        className="w-full p-2 border border-amber-700 rounded-lg text-sm font-medium bg-amber-950 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-amber-300 block mb-1">Detalle / Envase</label>
                      <input
                        type="text"
                        placeholder="Ej: Caja x 12u"
                        value={v.detalle}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, detalle: val } : item));
                        }}
                        className="w-full p-2 border border-amber-700 rounded-lg text-sm font-medium bg-amber-950 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-amber-300 block mb-1">Precio Variante ($)</label>
                      <input
                        type="number"
                        placeholder="Si difiere del base"
                        value={v.precio}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, precio: val } : item));
                        }}
                        className="w-full p-2 border border-amber-700 rounded-lg text-sm font-medium bg-amber-950 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-amber-300 block mb-1">Foto Variante</label>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer bg-amber-800 hover:bg-amber-700 text-amber-200 text-xs font-bold py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 w-full shadow-sm transition-colors border border-amber-700">
                          {subiendoImagenVarIdx === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          <span>{v.imagen_asociada_url ? 'Cambiar' : 'Subir'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSubirImagen(e, false, idx)}
                            disabled={subiendoImagenVarIdx === idx}
                            className="hidden"
                          />
                        </label>

                        {v.imagen_asociada_url && (
                          <div className="relative group w-8 h-8 border border-amber-700 rounded-lg overflow-hidden flex-shrink-0">
                            <img src={v.imagen_asociada_url} alt="Variante" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, imagen_asociada_url: '' } : item))}
                              className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-2 md:pt-4">
                      {formVariantes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormVariantes(prev => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-red-400 hover:bg-red-950 rounded-lg transition-colors"
                          title="Eliminar Variante"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-amber-800">
                <button
                  type="submit"
                  disabled={subiendoImagen || subiendoImagenVarIdx !== null}
                  className="w-full bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-sm uppercase tracking-wider py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> {productoEditar ? 'Guardar Cambios del Producto' : 'Publicar Producto'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* LISTADO DE PRODUCTOS */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          {categoriaSeleccionada || busqueda || soloOfertas ? (
            <div>
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-amber-200">
                <button
                  onClick={() => { setCategoriaSeleccionada(null); setBusqueda(''); setSoloOfertas(false); }}
                  className="flex items-center gap-1.5 text-sm font-extrabold text-amber-800 hover:underline uppercase tracking-wider"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver a la portada
                </button>
                <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">
                  {soloOfertas ? '🔥 Promociones Destacadas' : categoriaSeleccionada || `Búsqueda: "${busqueda}"`}
                </h2>
              </div>

              {productosFiltrados.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-amber-200 text-zinc-500 text-base font-semibold">
                  No encontramos productos en esta sección.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                  {productosFiltrados.map((prod) => {
                    const tieneOferta = prod.precio_oferta && Number(prod.precio_oferta) > 0;
                    const fotoPrincipal = (prod.imagenes && prod.imagenes[0]) || prod.imagen_url;

                    return (
                      <div
                        key={prod.id}
                        onClick={() => abrirDetalleProducto(prod)}
                        className="bg-white rounded-3xl overflow-hidden border border-amber-200 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between relative group cursor-pointer"
                      >
                        {tieneOferta && (
                          <div className="absolute top-3 left-3 z-10 bg-rose-600 text-white text-sm font-black uppercase px-3 py-1 rounded-full shadow-md">
                            OFERTA
                          </div>
                        )}

                        {esAdmin && (
                          <div
                            className="absolute top-2 right-2 z-20 flex gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button onClick={(e) => editarProducto(prod, e)} className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={(e) => eliminarProducto(prod.id, e)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        <div>
                          <div className="h-52 sm:h-64 w-full bg-amber-50 relative overflow-hidden">
                            {fotoPrincipal ? (
                              <img src={fotoPrincipal} alt={prod.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-amber-300">
                                <ImageIcon className="w-10 h-10 mb-1" />
                                <span className="text-sm font-semibold">Sin imagen</span>
                              </div>
                            )}
                          </div>

                          <div className="p-4">
                            <span className="text-sm font-black text-amber-700 uppercase tracking-widest">{prod.categoria}</span>
                            <h3 className="font-extrabold text-base sm:text-lg text-zinc-900 line-clamp-2 mt-1 leading-snug">{prod.titulo}</h3>
                            {prod.descripcion && (
                              <p className="text-sm sm:text-sm text-zinc-500 line-clamp-2 mt-1">{prod.descripcion}</p>
                            )}

                            <div className="mt-3 flex items-baseline gap-2">
                              {tieneOferta ? (
                                <>
                                  <span className="text-xl sm:text-2xl font-black text-rose-600">${prod.precio_oferta}</span>
                                  <span className="text-sm sm:text-sm text-zinc-400 line-through font-bold">${prod.precio_base}</span>
                                </>
                              ) : (
                                <span className="text-xl sm:text-2xl font-black text-zinc-900">${prod.precio_base}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 pt-0">
                          <button
                            className="w-full py-3 bg-amber-950 group-hover:bg-amber-400 group-hover:text-amber-950 text-amber-300 border border-amber-400/30 rounded-2xl text-sm sm:text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-md"
                          >
                            Ver Opciones
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* CATEGORÍAS EN PORTADA */
            <section>
              <div className="text-center mb-10">
                <span className="text-sm font-black uppercase tracking-widest text-amber-800">VARIEDAD ARTESANAL</span>
                <h3 className="text-3xl sm:text-5xl font-black text-zinc-900 uppercase tracking-tight mt-1">NUESTROS PRODUCTOS</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                {categorias.map((cat) => (
                  <div
                    key={cat}
                    onClick={() => setCategoriaSeleccionada(cat)}
                    className="group relative h-80 sm:h-96 rounded-3xl overflow-hidden shadow-lg cursor-pointer flex items-end p-6 border border-amber-200 transition-transform duration-300 hover:-translate-y-2"
                  >
                    <img
                      src={obtenerImagenCategoria(cat)}
                      alt={cat}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-amber-950/85 via-amber-950/30 to-transparent" />

                    <div className="relative z-10 w-full bg-amber-950/90 backdrop-blur-md p-5 rounded-2xl text-center shadow-2xl border border-amber-500/20">
                      <span className="text-sm font-black text-amber-300 uppercase tracking-widest">CATEGORÍA</span>
                      <h4 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider mt-0.5">{cat}</h4>
                      <span className="inline-block mt-3 px-5 py-2.5 bg-amber-400 text-amber-950 text-sm sm:text-sm font-black rounded-xl uppercase tracking-wider transition-colors shadow-md">
                        VER PRODUCTOS
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* MODAL DETALLE DE PRODUCTO */}
      {productoDetalle && (() => {
        const infoPrecio = obtenerPrecioActual();
        const galeriaCompleta = construirGaleria(productoDetalle);
        const listaImagenes = galeriaCompleta.map((g) => g.url);

        const imagenAMostrar = imagenVarianteDirecta || listaImagenes[imagenActivaIndex] || listaImagenes[0];

        const irImagenSiguiente = () => {
          if (listaImagenes.length <= 1) return;
          setImagenVarianteDirecta(null);
          setImagenHoverZoom(false);
          setPanZoom({ x: 0, y: 0 });
          setImagenActivaIndex((prev) => {
            const nuevoIndex = (prev + 1) % listaImagenes.length;
            const item = galeriaCompleta[nuevoIndex];
            if (item?.variante) {
              setSaborSel(item.variante.sabor_presentacion || '');
              setDetalleSel(item.variante.detalle || '');
            }
            return nuevoIndex;
          });
        };
        const irImagenAnterior = () => {
          if (listaImagenes.length <= 1) return;
          setImagenVarianteDirecta(null);
          setImagenHoverZoom(false);
          setPanZoom({ x: 0, y: 0 });
          setImagenActivaIndex((prev) => {
            const nuevoIndex = (prev - 1 + listaImagenes.length) % listaImagenes.length;
            const item = galeriaCompleta[nuevoIndex];
            if (item?.variante) {
              setSaborSel(item.variante.sabor_presentacion || '');
              setDetalleSel(item.variante.detalle || '');
            }
            return nuevoIndex;
          });
        };

        const seleccionarFoto = (idx) => {
          const item = galeriaCompleta[idx];
          setImagenActivaIndex(idx);
          setImagenVarianteDirecta(null);
          if (item?.variante) {
            setSaborSel(item.variante.sabor_presentacion || '');
            setDetalleSel(item.variante.detalle || '');
          }
        };

        const manejarMouseMoveZoom = (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          setZoomPos({ x, y });
        };

        const manejarFinDeToqueLightbox = (e) => {
          if (tieneMousePreciso()) return;
          const estado = arrastreZoomRef.current;
          const fueArrastre = estado.arrastro;
          const fueHorizontal = estado.esHorizontal;
          const inicio = estado.inicio;
          arrastreZoomRef.current = { inicio: null, panInicial: { x: 0, y: 0 }, arrastro: false, esHorizontal: null };

          if (imagenHoverZoom) {
            if (!fueArrastre) {
              e.preventDefault();
              e.stopPropagation();
              setImagenHoverZoom(false);
              setPanZoom({ x: 0, y: 0 });
            }
            return;
          }

          if (fueHorizontal && inicio) {
            const touch = e.changedTouches[0];
            const dx = touch.clientX - inicio.x;
            if (Math.abs(dx) > 40) {
              e.preventDefault();
              e.stopPropagation();
              if (dx < 0) irImagenSiguiente();
              else irImagenAnterior();
              return;
            }
          }

          if (!fueArrastre) {
            e.preventDefault();
            e.stopPropagation();
            const touch = e.changedTouches[0];
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((touch.clientX - rect.left) / rect.width) * 100;
            const y = ((touch.clientY - rect.top) / rect.height) * 100;
            setZoomPos({ x, y });
            setPanZoom({ x: 0, y: 0 });
            setImagenHoverZoom(true);
          }
        };

        const cerrarDetalle = () => {
          setProductoDetalle(null);
          setLightboxAbierto(false);
          setImagenHoverZoom(false);
          setPanZoom({ x: 0, y: 0 });
        };

        const variantes = productoDetalle.variantes || [];
        const saboresDisponibles = [...new Set(variantes.map(v => v.sabor_presentacion).filter(Boolean))];
        const detallesDisponibles = [...new Set(variantes.map(v => v.detalle).filter(Boolean))];

        return (
          <>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-950/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-amber-100 my-auto relative flex flex-col md:flex-row">
              <button
                onClick={cerrarDetalle}
                className="absolute top-4 right-4 z-20 bg-amber-50 hover:bg-amber-100 text-amber-900 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* GALERÍA DE FOTOS */}
              <div className="w-full md:w-1/2 p-6 bg-amber-50/40 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-amber-200">
                <div
                  className="w-full h-80 sm:h-[28rem] rounded-2xl overflow-hidden bg-white shadow-inner relative flex items-center justify-center group touch-pan-y cursor-zoom-in"
                  onTouchStart={(e) => { touchStartXRef.current = e.touches[0].clientX; }}
                  onTouchEnd={(e) => {
                    if (touchStartXRef.current === null) return;
                    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
                    touchStartXRef.current = null;
                    if (Math.abs(deltaX) < 25) return;
                    e.preventDefault();
                    if (deltaX < 0) irImagenSiguiente();
                    else irImagenAnterior();
                  }}
                  onMouseEnter={() => { if (tieneMousePreciso()) setImagenHoverZoom(true); }}
                  onMouseLeave={() => setImagenHoverZoom(false)}
                  onMouseMove={(e) => { if (tieneMousePreciso()) manejarMouseMoveZoom(e); }}
                  onClick={() => imagenAMostrar && setLightboxAbierto(true)}
                >
                  {imagenAMostrar ? (
                    <img
                      src={imagenAMostrar}
                      alt={productoDetalle.titulo}
                      className="w-full h-full object-contain select-none transition-transform duration-150 ease-out"
                      style={imagenHoverZoom ? { transform: 'scale(2)', transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` } : undefined}
                      draggable={false}
                    />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-amber-300" />
                  )}

                  {imagenAMostrar && (
                    <div className="absolute bottom-3 right-3 z-10 bg-white/90 text-amber-900 p-2 rounded-full shadow pointer-events-none">
                      <ZoomIn className="w-4 h-4" />
                    </div>
                  )}

                  {listaImagenes.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); irImagenAnterior(); }}
                        aria-label="Foto anterior"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-zinc-700 rounded-full p-2 shadow-md transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); irImagenSiguiente(); }}
                        aria-label="Foto siguiente"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-zinc-700 rounded-full p-2 shadow-md transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* MINIATURAS */}
                {listaImagenes.length > 1 && (
                  <div className="flex items-center gap-3 mt-4 overflow-x-auto max-w-full pb-2">
                    {galeriaCompleta.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => seleccionarFoto(idx)}
                        title={item.variante ? [item.variante.sabor_presentacion, item.variante.detalle].filter(Boolean).join(' / ') : undefined}
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${(!imagenVarianteDirecta && imagenActivaIndex === idx) ? 'border-amber-500 scale-105 shadow' : 'border-amber-200 opacity-60'}`}
                      >
                        <img src={item.url} alt="Miniatura" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* DETALLES DE VARIANTES */}
              <div className="w-full md:w-1/2 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-black text-amber-700 uppercase tracking-widest">{productoDetalle.categoria}</span>
                      <h2 className="text-2xl font-black text-zinc-900 leading-tight mt-1">{productoDetalle.titulo}</h2>
                    </div>
                    <button
                      onClick={compartirProducto}
                      aria-label="Compartir"
                      title="Compartir"
                      className="flex-shrink-0 flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 px-3 py-2 rounded-xl transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="text-xs font-black uppercase tracking-wide hidden sm:inline">Compartir</span>
                    </button>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-zinc-900">${infoPrecio.precio}</span>
                    {infoPrecio.precioOriginal && (
                      <span className="text-sm font-bold text-zinc-400 line-through">${infoPrecio.precioOriginal}</span>
                    )}
                  </div>

                  {productoDetalle.descripcion && (
                    <p className="text-sm text-zinc-600 leading-relaxed font-medium bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                      {productoDetalle.descripcion}
                    </p>
                  )}

                  {/* SELECTORES DE SABOR Y DETALLE */}
                  <div className="space-y-3 pt-2">
                    {saboresDisponibles.length > 0 && (
                      <div>
                        <label className="text-sm font-bold text-zinc-700 block mb-1">Sabor / Presentación:</label>
                        <select
                          value={saborSel}
                          onChange={(e) => handleCambioVariante('sabor', e.target.value)}
                          className="w-full p-2.5 bg-amber-50/50 border border-amber-200 rounded-xl text-sm font-bold text-zinc-800 focus:ring-2 focus:ring-amber-400"
                        >
                          {saboresDisponibles.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {detallesDisponibles.length > 0 && (
                      <div>
                        <label className="text-sm font-bold text-zinc-700 block mb-1">Detalle / Empaque:</label>
                        <select
                          value={detalleSel}
                          onChange={(e) => handleCambioVariante('detalle', e.target.value)}
                          className="w-full p-2.5 bg-amber-50/50 border border-amber-200 rounded-xl text-sm font-bold text-zinc-800 focus:ring-2 focus:ring-amber-400"
                        >
                          {detallesDisponibles.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* CANTIDAD */}
                  <div className="pt-2 flex items-center justify-between border-t border-amber-100">
                    <span className="text-xs font-black uppercase tracking-wider block text-zinc-500">Cantidad:</span>
                    <div className="flex items-center border border-amber-300 rounded-xl bg-amber-50/50">
                      <button
                        onClick={() => setCantidadSel(prev => Math.max(1, prev - 1))}
                        className="p-2 text-zinc-600 hover:text-zinc-900"
                        disabled={cantidadSel <= 1}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-sm font-black">{cantidadSel}</span>
                      <button
                        onClick={() => setCantidadSel(prev => prev + 1)}
                        className="p-2 text-zinc-600 hover:text-zinc-900"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={agregarAlCarritoDesdeDetalle}
                  className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Agregar al Pedido
                </button>
              </div>
            </div>
          </div>

          {/* LIGHTBOX */}
          {lightboxAbierto && imagenAMostrar && (
            <div
              className="fixed inset-0 z-[60] bg-amber-950/95 flex items-center justify-center p-4"
              onClick={() => { setLightboxAbierto(false); setImagenHoverZoom(false); setPanZoom({ x: 0, y: 0 }); }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxAbierto(false); setImagenHoverZoom(false); setPanZoom({ x: 0, y: 0 }); }}
                aria-label="Cerrar"
                className="absolute top-4 right-4 z-20 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              {listaImagenes.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); irImagenAnterior(); }}
                    aria-label="Foto anterior"
                    className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); irImagenSiguiente(); }}
                    aria-label="Foto siguiente"
                    className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              <div
                ref={lightboxImgRef}
                className="relative w-full h-full max-w-5xl max-h-[85vh] overflow-hidden flex items-center justify-center cursor-zoom-in"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => { if (tieneMousePreciso()) setImagenHoverZoom(true); }}
                onMouseLeave={() => setImagenHoverZoom(false)}
                onMouseMove={(e) => { if (tieneMousePreciso()) manejarMouseMoveZoom(e); }}
                onTouchEnd={manejarFinDeToqueLightbox}
              >
                <img
                  src={imagenAMostrar}
                  alt={productoDetalle.titulo}
                  className="max-w-full max-h-full object-contain select-none transition-transform duration-150 ease-out"
                  style={imagenHoverZoom ? { transform: `translate(${panZoom.x}px, ${panZoom.y}px) scale(2.2)`, transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` } : undefined}
                  draggable={false}
                />
              </div>
            </div>
          )}
          </>
        );
      })()}

      {/* Botón WhatsApp Flotante */}
      <a
        href={`https://wa.me/${configNegocio.whatsapp || "5491156988468"}`}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-10 right-6 z-40 bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-110 flex items-center justify-center border-2 border-white"
        title="Consultar por WhatsApp"
      >
        <MessageCircle className="w-8 h-8 fill-current" />
      </a>

      {/* MODAL LOGIN ADMIN */}
      {modalAdminAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-950/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-amber-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-zinc-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-700" /> Acceso Panel Admin
              </h3>
              <button onClick={() => setModalAdminAbierto(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLoginAdmin} className="space-y-4">
              <div>
                <label className="text-sm text-zinc-700 font-bold block mb-1">Email:</label>
                <input
                  type="email"
                  required
                  placeholder="tiendadepan@guiaclic.com.ar"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full p-3 border border-amber-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
              <label className="text-sm text-zinc-700 font-bold block mb-1">Contraseña:</label>
              <div className="relative">
                <input
                  type={mostrarPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full p-3 pr-10 border border-amber-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
                  title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

              {errorPassword && <p className="text-sm text-rose-600 font-bold">{errorPassword}</p>}

              <button
                type="submit"
                disabled={cargandoAuth}
                className="w-full py-3 bg-amber-950 hover:bg-amber-900 text-amber-300 font-black text-sm uppercase tracking-wider transition-colors disabled:opacity-50 shadow-md"
              >
                {cargandoAuth ? 'Verificando...' : 'Ingresar al Panel'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER CARRITO */}
      {carritoAbierto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-amber-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
            <div className="p-4 border-b border-amber-200 flex justify-between items-center bg-amber-50/50">
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-zinc-900">Tu Pedido ({totalItems})</h2>
              <div className="flex items-center gap-1">
                {carrito.length > 0 && (
                  <button
                    onClick={vaciarCarrito}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg uppercase tracking-wide"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Vaciar
                  </button>
                )}
                <button onClick={() => setCarritoAbierto(false)} className="p-1 text-zinc-400 hover:text-zinc-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {carrito.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 text-sm font-medium">El pedido está vacío.</div>
              ) : (
                carrito.map((item) => (
                  <div key={item.id} className="flex gap-3 items-center border-b border-amber-100 pb-3">
                    <div className="w-12 h-12 bg-amber-50 rounded-xl overflow-hidden flex-shrink-0">
                      {item.imagen ? (
                        <img src={item.imagen} alt={item.titulo} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-400">Sin foto</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-zinc-900 truncate">{item.titulo}</h4>
                      {(item.sabor_presentacion || item.detalle) && (
                        <p className="text-xs text-zinc-500 font-medium truncate">
                          {[item.sabor_presentacion, item.detalle].filter(Boolean).join(' / ')}
                        </p>
                      )}
                      <p className="text-sm font-black text-amber-700">${item.precioEfectivo}</p>
                    </div>
                    <div className="flex items-center border border-amber-200 rounded-lg">
                      <button onClick={() => modificarCantidad(item.id, -1)} className="p-1 text-zinc-600">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-sm font-bold">{item.cantidad}</span>
                      <button onClick={() => modificarCantidad(item.id, 1)} className="p-1 text-zinc-600">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {carrito.length > 0 && (
              <div className="p-4 border-t border-amber-200 bg-amber-50/30 space-y-3">
                <div className="flex justify-between items-center text-sm font-extrabold text-zinc-900">
                  <span>Total Estimado:</span>
                  <span className="text-lg font-black text-zinc-900">${totalCarrito}</span>
                </div>

                {!cumpleMinimo && (
                  <p className="text-xs font-bold text-rose-600 text-center bg-rose-50 p-2 rounded-xl border border-rose-200">
                    ⚠️ El mínimo de compra para envío es de ${MINIMO_ENVIO}. Te faltan ${MINIMO_ENVIO - totalCarrito} para completar el pedido.
                  </p>
                )}

                <button
                  onClick={enviarPedidoWhatsApp}
                  disabled={!cumpleMinimo}
                  className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-colors ${
                    cumpleMinimo
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                      : 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  {cumpleMinimo ? 'Finalizar Pedido por WhatsApp' : 'Mínimo de Envío No Alcanzado'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOAST */}
      {toastMensaje && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-amber-950/95 text-amber-300 text-sm font-bold px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-amber-500/30 flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMensaje}</span>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-amber-950 text-amber-200 pt-12 pb-8 px-4 border-t border-amber-700/30 mt-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 text-left">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <img src="/logo.jpg" alt={configNegocio.nombre} className="w-10 h-10 rounded-full border border-amber-300 object-cover" />
              <div>
                <h4 className="text-white font-bold text-lg leading-tight">{configNegocio.nombre}</h4>
                <span className="text-amber-300 text-sm font-medium tracking-wide">{configNegocio.subtitulo}</span>
              </div>
            </div>
            <p className="text-sm text-amber-200/80 mb-4 leading-relaxed">
              Panadería y pastelería mayorista. Envíos programados directamente a tu comercio o domicilio.
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold text-lg mb-3 flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-amber-300" />
              <span>Zonas de Cobertura</span>
            </h4>
            <div className="space-y-2 text-sm text-amber-100">
              <p>📍 {configNegocio.zonas_cobertura}</p>
              <p className="pt-1">📞 <strong>WhatsApp:</strong> {configNegocio.whatsapp}</p>
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold text-lg mb-3">Plataforma</h4>
            <p className="text-sm text-amber-200/80">
              Comercio Adherido a <a href={GUIA_CLIC_URL} target="_blank" rel="noopener noreferrer" className="text-amber-300 font-semibold hover:underline">GuiaClic</a>
            </p>
          </div>
        </div>

        <div className="border-t border-amber-900 pt-6 text-center text-sm text-amber-300/60">
          © {new Date().getFullYear()} {configNegocio.nombre}. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}