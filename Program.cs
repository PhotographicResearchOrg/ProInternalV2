using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System;
using Microsoft.AspNetCore.Http.Features;
using System.Text;
using Microsoft.Extensions.FileProviders;
using System.IO;
using Microsoft.AspNetCore.Http;
using System.Net.Http;
using System.Runtime.InteropServices;
using ProInternal.Services;
using Microsoft.AspNetCore.SpaServices.AngularCli;
using Microsoft.Data.SqlClient;
using ProInternal;

var builder = WebApplication.CreateBuilder(args);


//Add services to the container.
builder.Services.AddControllersWithViews();


//builder.Services.AddControllers();
builder.Services.AddHttpClient();


builder.Services.Configure<AppConfigurations>(
    builder.Configuration.GetSection("AppConfigurations")
);


var configuration = builder.Configuration;

//New
builder.Services.AddSingleton<PowerBIService>();

builder.Services.AddScoped<IProDataAccess>(provider => new ProDataAccess(builder.Configuration.GetConnectionString("ProConnectionString")));
builder.Services.AddScoped<IDRADataAccess>(provider => new DRADataAccess(builder.Configuration.GetConnectionString("DRAConnectionString")));
builder.Services.AddScoped<INukeDataAccess>(provider => new NukeDataAccess(builder.Configuration.GetConnectionString("NukeConnectionString")));
builder.Services.AddScoped<IEDADataAccess>(provider => new EDADataAccess(builder.Configuration.GetConnectionString("EDAConnectionString")));

//EDAConnectionString
//EDAConnectionString
builder.Services.AddCors();

// In production, the Angular files will be served from this directory
builder.Services.AddSpaStaticFiles(configuration =>
{
    configuration.RootPath = "dist";
});




var app = builder.Build();

//Configure the HTTP request pipeline.
//Force SSL
if (!app.Environment.IsDevelopment())
{
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

//UseHttpsRedirection causes an automatic redirection to HTTPS URL when an HTTP URL is received,
app.UseHttpsRedirection();


app.UseCors(x => x.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());


app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(app.Environment.WebRootPath, "uploads")),
    RequestPath = "/uploads"
});


if (!app.Environment.IsDevelopment())
{
    //Serves static file like image, css, js in asset folder of angular app
    app.UseSpaStaticFiles();
}

app.UseAuthentication();
app.UseRouting();
app.UseAuthorization();

//This is new. 
//app.UseEndpoints(builder => builder.MapDefaultControllerRoute());
app.UseEndpoints(endpoints => endpoints.MapControllers());


////UseSpa - let asp.net core know which directory you want to run your angular app,
////what dist folder when running in production mode and which command to run angular app in dev mode
app.UseSpa(spa =>
{
    // To learn more about options for serving an Angular SPA from ASP.NET Core,
    // see https://go.microsoft.com/fwlink/?linkid=864501

    spa.Options.SourcePath = "ClientApp";

    if (app.Environment.IsDevelopment())
    {
        spa.UseAngularCliServer(npmScript: "start");
    }

});

// Enable Angular routing fallback
app.MapFallbackToFile("index.html");

app.Run();
