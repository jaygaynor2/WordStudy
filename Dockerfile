FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY WordStudy.sln ./
COPY src/WordStudy.Api/WordStudy.Api.csproj src/WordStudy.Api/
COPY tests/WordStudy.Tests/WordStudy.Tests.csproj tests/WordStudy.Tests/
RUN dotnet restore WordStudy.sln
COPY . .
RUN dotnet publish src/WordStudy.Api/WordStudy.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "WordStudy.Api.dll"]
