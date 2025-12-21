#!/usr/bin/env python3
"""
MultiKit Tool - IP Lookup & Phone Lookup
Herramienta multifuncional para análisis de IPs y números de teléfono
"""

import phonenumbers
from phonenumbers import geocoder, carrier, timezone
import requests
import json
import sys
import os

class MultiKit:
    def __init__(self):
        self.colors = {
            'green': '\033[92m',
            'red': '\033[91m',
            'yellow': '\033[93m',
            'blue': '\033[94m',
            'cyan': '\033[96m',
            'white': '\033[97m',
            'magenta': '\033[95m',
            'reset': '\033[0m'
        }
    
    def clear_screen(self):
        os.system('cls' if os.name == 'nt' else 'clear')
    
    def print_banner(self):
        banner = f"""
{self.colors['cyan']}
╔═══════════════════════════════════════╗
║            MULTIKIT TOOL              ║
║        IP Lookup & Phone Lookup       ║
║              by Assistant             ║
╚═══════════════════════════════════════╝
{self.colors['reset']}
        """
        print(banner)
    
    def print_menu(self):
        menu = f"""
{self.colors['yellow']}┌─────────────────────────────────────┐
│              MENÚ PRINCIPAL         │
└─────────────────────────────────────┘{self.colors['reset']}

{self.colors['green']}[1]{self.colors['white']} IP Lookup{self.colors['reset']}
{self.colors['green']}[2]{self.colors['white']} Phone Lookup{self.colors['reset']}
{self.colors['green']}[0]{self.colors['white']} Salir{self.colors['reset']}

{self.colors['cyan']}Selecciona una opción: {self.colors['reset']}"""
        print(menu, end='')
    
    def ip_lookup(self, ip_address):
        """
        Realiza lookup de una dirección IP
        """
        try:
            print(f"\n{self.colors['yellow']}Analizando IP: {ip_address}{self.colors['reset']}")
            
            # Usar ipapi.co para obtener información
            response = requests.get(f"http://ipapi.co/{ip_address}/json/", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                print(f"\n{self.colors['green']}INFORMACIÓN COMPLETA DE LA IP{self.colors['reset']}")
                print(f"{self.colors['yellow']}{'='*60}{self.colors['reset']}")
                
                # Información básica
                basic_info = f"IP: {data.get('ip', 'N/A')} | Tipo: IPv{data.get('version', 'N/A')}"
                print(f"{self.colors['white']}{basic_info}{self.colors['reset']}")
                
                # Ubicación completa
                location = f"Ubicación: {data.get('city', 'N/A')}, {data.get('region', 'N/A')}, {data.get('country_name', 'N/A')} ({data.get('country_code', 'N/A')})"
                print(f"{self.colors['blue']}{location}{self.colors['reset']}")
                
                # Coordenadas
                coords = f"Coordenadas: Lat: {data.get('latitude', 'N/A')}, Lng: {data.get('longitude', 'N/A')}"
                if data.get('postal'):
                    coords += f" | Código postal: {data.get('postal')}"
                print(f"{self.colors['blue']}{coords}{self.colors['reset']}")
                
                # Red e ISP
                network_info = f"ISP: {data.get('org', 'N/A')}"
                if data.get('asn'):
                    network_info += f" | ASN: {data.get('asn')}"
                print(f"{self.colors['cyan']}{network_info}{self.colors['reset']}")
                
                # Zona horaria
                timezone_info = f"Zona horaria: {data.get('timezone', 'N/A')} (UTC{data.get('utc_offset', '')})"
                print(f"{self.colors['magenta']}{timezone_info}{self.colors['reset']}")
                
                # Idiomas y moneda
                if data.get('languages') and data.get('currency'):
                    extra_info = f"Idiomas: {data.get('languages')} | Moneda: {data.get('currency')} ({data.get('currency_name', 'N/A')})"
                    print(f"{self.colors['yellow']}{extra_info}{self.colors['reset']}")
                elif data.get('languages'):
                    print(f"{self.colors['yellow']}Idiomas: {data.get('languages')}{self.colors['reset']}")
                elif data.get('currency'):
                    print(f"{self.colors['yellow']}Moneda: {data.get('currency')} ({data.get('currency_name', 'N/A')}){self.colors['reset']}")
                
                return True
            else:
                print(f"{self.colors['red']}Error al obtener información de la IP{self.colors['reset']}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"{self.colors['red']}Error de conexión: {e}{self.colors['reset']}")
            return False
        except Exception as e:
            print(f"{self.colors['red']}Error inesperado: {e}{self.colors['reset']}")
            return False
    
    def phone_lookup(self, phone_number):
        """
        Realiza lookup de un número de teléfono
        """
        try:
            print(f"\n{self.colors['yellow']}Analizando número: {phone_number}{self.colors['reset']}")
            
            # Limpiar y normalizar el número (mantener solo dígitos y el símbolo +)
            # Esto permite formatos como: +1 (956) 503-7061, +1-956-503-7061, etc.
            cleaned_number = phone_number.strip()
            
            # Parsear el número (phonenumbers maneja automáticamente espacios, paréntesis y guiones)
            parsed_number = phonenumbers.parse(cleaned_number, None)
            
            # Validar el número
            if not phonenumbers.is_valid_number(parsed_number):
                print(f"{self.colors['red']}Número de teléfono inválido{self.colors['reset']}")
                return False
            
            # Obtener información básica
            country = geocoder.description_for_number(parsed_number, "es")
            carrier_name = carrier.name_for_number(parsed_number, "es")
            timezones = timezone.time_zones_for_number(parsed_number)
            
            # Formatear número
            international_format = phonenumbers.format_number(parsed_number, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
            national_format = phonenumbers.format_number(parsed_number, phonenumbers.PhoneNumberFormat.NATIONAL)
            e164_format = phonenumbers.format_number(parsed_number, phonenumbers.PhoneNumberFormat.E164)
            rfc3966_format = phonenumbers.format_number(parsed_number, phonenumbers.PhoneNumberFormat.RFC3966)
            
            # Obtener información adicional del país
            country_info = self.get_country_info(parsed_number.country_code)
            region_info = self.get_region_info(parsed_number.country_code)
            number_type = self.get_number_type(parsed_number)
            
            # Mostrar toda la información junta
            print(f"\n{self.colors['green']}INFORMACIÓN COMPLETA DEL NÚMERO{self.colors['reset']}")
            print(f"{self.colors['yellow']}{'='*70}{self.colors['reset']}")
            
            # Información básica compacta
            print(f"{self.colors['white']}Original: {phone_number} | Internacional: {international_format} | Nacional: {national_format}{self.colors['reset']}")
            print(f"{self.colors['white']}E164: {e164_format} | RFC3966: {rfc3966_format}{self.colors['reset']}")
            
            # Información geográfica y técnica
            location_info = f"País: {country if country else 'No disponible'} | Código: +{parsed_number.country_code} | ISO: {country_info['iso_code']}"
            print(f"{self.colors['blue']}{location_info}{self.colors['reset']}")
            
            if country_info['coordinates']:
                coords_capital = f"Coordenadas: {country_info['coordinates']} | Capital: {country_info['capital']}"
                print(f"{self.colors['blue']}{coords_capital}{self.colors['reset']}")
            
            # Red y operador
            network_info = f"Operador: {carrier_name if carrier_name else 'No disponible'} | Tipo: {number_type} | Longitud: {len(str(parsed_number.national_number))} dígitos"
            print(f"{self.colors['cyan']}{network_info}{self.colors['reset']}")
            
            # Zona horaria
            if timezones:
                tz_info = f"Zona horaria: {' | '.join(timezones)}"
                print(f"{self.colors['magenta']}{tz_info}{self.colors['reset']}")
            
            # Información del país
            if country_info['currency']:
                country_details = f"Moneda: {country_info['currency']} | Idioma: {country_info['language']} | Población: {country_info['population']}"
                print(f"{self.colors['yellow']}{country_details}{self.colors['reset']}")
            
            # Validación
            valid_info = f"Válido: {'Sí' if phonenumbers.is_valid_number(parsed_number) else 'No'} | Posible: {'Sí' if phonenumbers.is_possible_number(parsed_number) else 'No'}"
            print(f"{self.colors['green']}{valid_info}{self.colors['reset']}")
            
            # Información regional
            if region_info:
                for key, value in region_info.items():
                    if value:
                        print(f"{self.colors['white']}{key}: {value}{self.colors['reset']}")
            
            return True
            
        except phonenumbers.NumberParseException as e:
            print(f"{self.colors['red']}Error al parsear el número: {e}{self.colors['reset']}")
            return False
        except Exception as e:
            print(f"{self.colors['red']}Error inesperado: {e}{self.colors['reset']}")
            return False
    
    def get_country_info(self, country_code):
        """
        Obtiene información detallada del país basada en el código de país
        """
        country_data = {
            1: {  # Estados Unidos/Canadá
                'iso_code': 'US/CA',
                'coordinates': 'Lat: 39.8283, Lng: -98.5795 (US) / Lat: 56.1304, Lng: -106.3468 (CA)',
                'capital': 'Washington D.C. (US) / Ottawa (CA)',
                'currency': 'USD / CAD',
                'language': 'Inglés / Francés',
                'population': '331M (US) / 38M (CA)'
            },
            34: {  # España
                'iso_code': 'ES',
                'coordinates': 'Lat: 40.4637, Lng: -3.7492',
                'capital': 'Madrid',
                'currency': 'EUR (Euro)',
                'language': 'Español',
                'population': '47.4M'
            },
            52: {  # México
                'iso_code': 'MX',
                'coordinates': 'Lat: 23.6345, Lng: -102.5528',
                'capital': 'Ciudad de México',
                'currency': 'MXN (Peso Mexicano)',
                'language': 'Español',
                'population': '128.9M'
            },
            33: {  # Francia
                'iso_code': 'FR',
                'coordinates': 'Lat: 46.2276, Lng: 2.2137',
                'capital': 'París',
                'currency': 'EUR (Euro)',
                'language': 'Francés',
                'population': '67.4M'
            },
            49: {  # Alemania
                'iso_code': 'DE',
                'coordinates': 'Lat: 51.1657, Lng: 10.4515',
                'capital': 'Berlín',
                'currency': 'EUR (Euro)',
                'language': 'Alemán',
                'population': '83.2M'
            },
            44: {  # Reino Unido
                'iso_code': 'GB',
                'coordinates': 'Lat: 55.3781, Lng: -3.4360',
                'capital': 'Londres',
                'currency': 'GBP (Libra Esterlina)',
                'language': 'Inglés',
                'population': '67.9M'
            },
            39: {  # Italia
                'iso_code': 'IT',
                'coordinates': 'Lat: 41.8719, Lng: 12.5674',
                'capital': 'Roma',
                'currency': 'EUR (Euro)',
                'language': 'Italiano',
                'population': '60.4M'
            },
            81: {  # Japón
                'iso_code': 'JP',
                'coordinates': 'Lat: 36.2048, Lng: 138.2529',
                'capital': 'Tokio',
                'currency': 'JPY (Yen)',
                'language': 'Japonés',
                'population': '125.8M'
            },
            86: {  # China
                'iso_code': 'CN',
                'coordinates': 'Lat: 35.8617, Lng: 104.1954',
                'capital': 'Beijing',
                'currency': 'CNY (Yuan)',
                'language': 'Chino Mandarín',
                'population': '1.4B'
            },
            55: {  # Brasil
                'iso_code': 'BR',
                'coordinates': 'Lat: -14.2350, Lng: -51.9253',
                'capital': 'Brasília',
                'currency': 'BRL (Real)',
                'language': 'Portugués',
                'population': '215.3M'
            },
            54: {  # Argentina
                'iso_code': 'AR',
                'coordinates': 'Lat: -38.4161, Lng: -63.6167',
                'capital': 'Buenos Aires',
                'currency': 'ARS (Peso Argentino)',
                'language': 'Español',
                'population': '45.4M'
            },
            91: {  # India
                'iso_code': 'IN',
                'coordinates': 'Lat: 20.5937, Lng: 78.9629',
                'capital': 'Nueva Delhi',
                'currency': 'INR (Rupia)',
                'language': 'Hindi/Inglés',
                'population': '1.38B'
            },
            7: {  # Rusia
                'iso_code': 'RU',
                'coordinates': 'Lat: 61.5240, Lng: 105.3188',
                'capital': 'Moscú',
                'currency': 'RUB (Rublo)',
                'language': 'Ruso',
                'population': '146.7M'
            },
            61: {  # Australia
                'iso_code': 'AU',
                'coordinates': 'Lat: -25.2744, Lng: 133.7751',
                'capital': 'Canberra',
                'currency': 'AUD (Dólar Australiano)',
                'language': 'Inglés',
                'population': '25.7M'
            }
        }
        
        return country_data.get(country_code, {
            'iso_code': 'N/A',
            'coordinates': None,
            'capital': None,
            'currency': None,
            'language': None,
            'population': None
        })
    
    def get_region_info(self, country_code):
        """
        Obtiene información regional específica
        """
        region_data = {
            1: {  # NANP (North American Numbering Plan)
                'Plan de numeración': 'NANP (North American Numbering Plan)',
                'Formato típico': 'NXX-NXX-XXXX',
                'Longitud': '10 dígitos (sin código de país)',
                'Área de cobertura': 'Estados Unidos, Canadá, y territorios'
            },
            34: {  # España
                'Plan de numeración': 'Plan Nacional de Numeración de España',
                'Formato típico': '9XX XXX XXX',
                'Longitud': '9 dígitos',
                'Prefijos móviles': '6XX, 7XX'
            },
            52: {  # México
                'Plan de numeración': 'Plan de Numeración de México',
                'Formato típico': 'XX XXXX XXXX',
                'Longitud': '10 dígitos',
                'Área de cobertura': 'República Mexicana'
            }
        }
        return region_data.get(country_code, None)
    
    def get_number_type(self, parsed_number):
        """
        Obtiene el tipo de número de teléfono
        """
        number_type = phonenumbers.number_type(parsed_number)
        types = {
            phonenumbers.PhoneNumberType.FIXED_LINE: "Línea fija",
            phonenumbers.PhoneNumberType.MOBILE: "Móvil",
            phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE: "Línea fija o móvil",
            phonenumbers.PhoneNumberType.TOLL_FREE: "Número gratuito",
            phonenumbers.PhoneNumberType.PREMIUM_RATE: "Número premium",
            phonenumbers.PhoneNumberType.SHARED_COST: "Costo compartido",
            phonenumbers.PhoneNumberType.VOIP: "VoIP",
            phonenumbers.PhoneNumberType.PERSONAL_NUMBER: "Número personal",
            phonenumbers.PhoneNumberType.PAGER: "Pager",
            phonenumbers.PhoneNumberType.UAN: "UAN",
            phonenumbers.PhoneNumberType.VOICEMAIL: "Buzón de voz",
            phonenumbers.PhoneNumberType.UNKNOWN: "Desconocido"
        }
        return types.get(number_type, "No identificado")

    def run(self):
        """
        Ejecuta el menú principal del multikit
        """
        while True:
            self.clear_screen()
            self.print_banner()
            self.print_menu()
            
            try:
                choice = input().strip()
                
                if choice == '0':
                    print(f"\n{self.colors['cyan']}¡Hasta luego!{self.colors['reset']}")
                    break
                
                elif choice == '1':
                    # IP Lookup
                    print(f"\n{self.colors['magenta']}IP LOOKUP{self.colors['reset']}")
                    print(f"{self.colors['yellow']}{'='*30}{self.colors['reset']}")
                    ip = input(f"{self.colors['cyan']}Ingresa la IP a consultar: {self.colors['reset']}").strip()
                    
                    if ip:
                        self.ip_lookup(ip)
                    else:
                        print(f"{self.colors['red']}Debes ingresar una IP válida{self.colors['reset']}")
                    
                    input(f"\n{self.colors['yellow']}Presiona Enter para continuar...{self.colors['reset']}")
                
                elif choice == '2':
                    # Phone Lookup
                    print(f"\n{self.colors['magenta']}PHONE LOOKUP{self.colors['reset']}")
                    print(f"{self.colors['yellow']}{'='*30}{self.colors['reset']}")
                    phone = input(f"{self.colors['cyan']}Ingresa el número de teléfono (ej: +1 (956) 503-7061): {self.colors['reset']}").strip()
                    
                    if phone:
                        self.phone_lookup(phone)
                    else:
                        print(f"{self.colors['red']}Debes ingresar un número válido{self.colors['reset']}")
                    
                    input(f"\n{self.colors['yellow']}Presiona Enter para continuar...{self.colors['reset']}")
                
                else:
                    print(f"{self.colors['red']}Opción inválida. Selecciona 0, 1 o 2{self.colors['reset']}")
                    input(f"\n{self.colors['yellow']}Presiona Enter para continuar...{self.colors['reset']}")
                    
            except KeyboardInterrupt:
                print(f"\n\n{self.colors['cyan']}¡Hasta luego!{self.colors['reset']}")
                break
            except Exception as e:
                print(f"{self.colors['red']}Error inesperado: {e}{self.colors['reset']}")
                input(f"\n{self.colors['yellow']}Presiona Enter para continuar...{self.colors['reset']}")

def main():
    multikit = MultiKit()
    multikit.run()

if __name__ == "__main__":
    main()