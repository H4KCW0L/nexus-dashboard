# MultiKit Tool 🛠️

Herramienta multifuncional en Python para análisis de IPs y números de teléfono con interfaz de menú interactivo.

## Características

### 🌐 IP Lookup
- ✅ Información de geolocalización
- 🏢 Datos del ISP/Organización
- 🕐 Zona horaria
- 💰 Moneda del país
- 🗣️ Idiomas
- 📊 Información de red (ASN)

### 📱 Phone Lookup
- ✅ Validación de números de teléfono
- 🌍 Identificación de país/región
- 📱 Detección de operador/carrier
- 🕐 Zona horaria
- 📊 Tipo de número (móvil, fijo, VoIP, etc.)
- 🎨 Múltiples formatos de número

## Instalación

```bash
pip install -r requirements.txt
```

## Uso

Simplemente ejecuta el script y se abrirá el menú interactivo:

```bash
python phone_lookup.py
```

### Menú Principal:
- **[1] IP Lookup**: Analiza direcciones IP
- **[2] Phone Lookup**: Analiza números de teléfono
- **[0] Salir**: Cierra la aplicación

### Ejemplos de uso:

**IP Lookup:**
- `8.8.8.8`
- `1.1.1.1`
- `192.168.1.1`

**Phone Lookup:**
- `+34612345678` (España)
- `+525512345678` (México)
- `+15551234567` (Estados Unidos)

## Características de la interfaz

- 🎨 Interfaz colorida y amigable
- 🔄 Menú interactivo con navegación fácil
- 🧹 Pantalla limpia entre operaciones
- ⌨️ Manejo de errores y validaciones
- 🚪 Salida limpia con Ctrl+C

## Información que proporciona

### IP Lookup:
- Ubicación geográfica (país, región, ciudad)
- Coordenadas (latitud/longitud)
- Información de red (ISP, ASN)
- Zona horaria y offset UTC
- Moneda e idiomas del país

### Phone Lookup:
- Formatos del número (internacional, nacional, E164)
- País/Región de origen
- Operador/Carrier
- Zona horaria
- Tipo de línea
- Validación completa

## Notas

- La información de IP utiliza servicios públicos gratuitos
- Para phone lookup, incluye siempre el código de país (+XX)
- Algunos datos pueden no estar disponibles según la fuente