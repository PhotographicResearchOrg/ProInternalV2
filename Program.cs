using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.SpaServices.AngularCli;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using ProInternal;
using ProInternal.Models.Accounting;
using ProInternal.Models.Accounts;
using ProInternal.Services;
using System;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;

var builder = WebApplication.CreateBuilder(args);


//Add services to the container.
builder.Services.AddControllersWithViews();


//builder.Services.AddControllers();
builder.Services.AddHttpClient();


builder.Services.Configure<AppConfigurations>(
    builder.Configuration.GetSection("AppConfigurations")
);


builder.Services.Configure<EmailSettings>(
    builder.Configuration.GetSection("Email")
);

var configuration = builder.Configuration;

//New
builder.Services.AddSingleton<PowerBIService>();
builder.Services.AddScoped<IProDataAccess>(provider => new ProDataAccess(builder.Configuration.GetConnectionString("ProConnectionString")));
builder.Services.AddScoped<IDRADataAccess>(provider => new DRADataAccess(builder.Configuration.GetConnectionString("DRAConnectionString")));
builder.Services.AddScoped<INukeDataAccess>(provider => new NukeDataAccess(builder.Configuration.GetConnectionString("NukeConnectionString")));
builder.Services.AddScoped<IEDADataAccess>(provider => new EDADataAccess(builder.Configuration.GetConnectionString("EDAConnectionString")));




builder.Services.AddHttpClient<IUvicornDataAccess, UvicornDataAccess>(c =>
{
    c.BaseAddress = new Uri("http://10.0.1.216:8000/"); // FastAPI base
    c.Timeout = TimeSpan.FromMinutes(15);
    c.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});

builder.Services.AddCors();

// In production, the Angular files will be served from this directory
builder.Services.AddSpaStaticFiles(configuration =>
{
    configuration.RootPath = "dist";
});

// Read secret and issuer from AppConfigurations.Jwt
var jwtSection = builder.Configuration.GetSection("AppConfigurations:Jwt");
var issuer = jwtSection["Issuer"];
var secret = jwtSection["Secret"];
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));

// Configure JWT authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = issuer,
        ValidAudience = issuer,
        IssuerSigningKey = key
    };
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

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(app.Environment.WebRootPath, "member-images")),
    RequestPath = "/member-images"
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(app.Environment.WebRootPath, "vendor-images")),
    RequestPath = "/vendor-images"
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
