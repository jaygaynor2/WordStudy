# Deployment

## Local

```bash
cd src/WordStudy.Web
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Docker

```bash
docker build -t word-study .
docker run --rm -p 8080:80 word-study
```

## Azure Container Registry

```bash
az acr create --resource-group rg-word-study --name wordstudy --sku Basic
az acr login --name wordstudy
docker tag word-study wordstudy.azurecr.io/word-study:latest
docker push wordstudy.azurecr.io/word-study:latest
```

## Azure App Service

```bash
az appservice plan create --name asp-word-study --resource-group rg-word-study --is-linux --sku B1
az webapp create --resource-group rg-word-study --plan asp-word-study --name app-word-study --deployment-container-image-name wordstudy.azurecr.io/word-study:latest
```

## Azure Kubernetes Service

```bash
az aks create --resource-group rg-word-study --name aks-word-study --attach-acr wordstudy --node-count 2
az aks get-credentials --resource-group rg-word-study --name aks-word-study
kubectl apply -f deploy/k8s/deployment.yaml
```
