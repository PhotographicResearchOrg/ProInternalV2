using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ProInternal.Services;
using ProInternal.Models.Auth;
using ProInternal.Models.Dashboard;
using Microsoft.AspNetCore.Cors;
using Newtonsoft.Json.Linq;
using ProInternal.Models.Configuration;
using Newtonsoft.Json;
using Microsoft.AspNetCore.DataProtection;
using ProInternal.Models;


namespace ProInternal.Controllers
{
    [Route("api/[controller]")]

    [ApiController]

    public class NotificationsController : ControllerBase
    {
        private IProDataAccess _proDataAccess;
        private AppConfigurations _appConfig;


        public NotificationsController(IProDataAccess proDataAccess, IOptions<AppConfigurations> appConfigurations )
        {
            _proDataAccess = proDataAccess;
            _appConfig = appConfigurations.Value;
        }


        [HttpGet]
        [Route("notifications")]
        public ActionResult<List<Notification>> GetUserNotifications()
        {
            var userIdClaim = User.FindFirst("userId")?.Value;

            if (int.TryParse(userIdClaim, out var userId))
            {
                List<Notification> notifications = _proDataAccess.GetNotificationsForUser(userId);
                return Ok(notifications);
            }

            return BadRequest("Invalid user ID");
        }


        [HttpPost]
        [Route("mark-read/{id}")]
        public IActionResult MarkNotificationAsRead(int id)
        {
            var userId = int.Parse(User.FindFirst("userId")?.Value ?? "0");
            _proDataAccess.MarkNotificationAsRead(id, userId);
            return Ok();
        }

        [HttpDelete]
        [Route("delete/{id}")]
        public IActionResult DeleteNotification(int id)
        {
            var userId = int.Parse(User.FindFirst("userId")?.Value ?? "0");
            _proDataAccess.DeleteNotification(id, userId);
            return Ok();
        }



    }
}
