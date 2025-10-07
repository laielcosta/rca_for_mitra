import requests

url = "http://192.168.1.1"
response = requests.get(url)
html = response.text

# Guardar en un archivo
with open("pagina.html", "w", encoding="utf-8") as file:
    file.write(html)