function UserStore (utilStore) {
  riot.observable(this)
  this.utilStore = utilStore
  this.userCurrrent

  this.sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  this.on('user_connect', function (user) {
    this.utilStore.ajaxCall({
      method: 'post',
      data: JSON.stringify(user),
      contentType: 'application/json',
      url: '/data/auth/authenticate',
      beforeSend: function () {
        this.trigger('ajax_send_login')
      }.bind(this)
    }).done(data => {
      if (data != null && data.token != null) {
        localStorage.token = data.token
        // window.open("../ihm/application.html", "_self");
        this.trigger('application_redirect')
        this.sleep(2000).then(function () {
          this.trigger('ajax_receipt_login', '/connexion')
        }.bind(this))
      } else if (data.err == 'google_user') {
        this.trigger('google_user')
        this.sleep(2000).then(function () {
          this.trigger('ajax_receipt_login', '/connexion')
        }.bind(this))
      } else if (data.err == 'no_account_found') {
        this.trigger('bad_auth')
        this.sleep(2000).then(function () {
          this.trigger('ajax_receipt_login', '/connexion')
        }.bind(this))
      } else if (data.err == 'probleme_procesus') {
        this.trigger('err_processus')
        this.sleep(2000).then(function () {
          this.trigger('ajax_receipt_login', '/connexion')
        }.bind(this))
      }
    })
  })

  this.on('google_connect', function (token) {
    var tokenObject = { token }
    this.utilStore.ajaxCall({
      method: 'post',
      data: JSON.stringify(tokenObject),
      contentType: 'application/json',
      url: '/data/auth/google_auth_statefull_verification',
      beforeSend: function () {
        this.trigger('ajax_send_login')
      }.bind(this)
    }).done(data => {
      if (data && data.token != null) {
        localStorage.token = data.token
        this.trigger('application_redirect')
        this.sleep(2000).then(function () {
          this.trigger('ajax_receipt_login', '/connexion')
        }.bind(this))
      } else {
        this.trigger('bad_auth')
        this.trigger('ajax_receipt_login', '/connexion')
      }
    })
  })

  this.on('forgot_password', function (email) {
    console.log(email)
    this.utilStore.ajaxCall({
      method: 'get',
      contentType: 'application/json',
      url: '/data/auth/passwordforget?mail=' + email
    }).done(data => {
      console.log('mail sent', data)
      if (data.state == 'mail_sent') {
        this.trigger('enter_code', data.user)
      } else {
        this.trigger('error_send_mail_code')
      }
    })
  })

  this.on('verife_code', function (data) {
    console.log('verifecode', data)
    if (data.user._id) {
      this.utilStore.ajaxCall({
        method: 'get',
        contentType: 'application/json',
        url: '/data/auth/verifycode/' + data.user._id + '/' + data.code
      }).done(data => {
        console.log('verif code done', data)
        if (data.state == 'good_code') {
          this.trigger('good_code', data.user)
        } else if (data.state == 'bad_code') {
          this.trigger('error_change_code')
        } else {
          this.trigger('token_expired')
        }
      })
    } else {
      this.trigger('back_send_mail')
    }
  })

  this.on('update_password', function (data) {
    console.log('update_password', JSON.stringify(data))
    this.utilStore.ajaxCall({
      method: 'post',
      contentType: 'application/json',
      data: JSON.stringify(data),
      url: '/data/auth/updatepassword'
    }).done(data => {
      if (data.state == 'password_update') {
        this.trigger('password_update')
      } else if (data.state == 'token_expired') {
        this.trigger('token_expired')
      } else if (data.state == 'no_user') {
        this.trigger('back_send_mail')
      } else {
        this.trigger('password_update_error')
      }
    })
  })

  this.on('user_inscription', function (user) {
    this.utilStore.ajaxCall({
      method: 'post',
      data: JSON.stringify(user),
      contentType: 'application/json',
      url: '/data/auth/inscription',
      beforeSend: function () {
        this.trigger('ajax_send_login')
      }.bind(this)
    }).done(data => {
      if (data != null && data.token != null) {
        localStorage.token = data.token
        this.trigger('application_redirect')
        this.sleep(2000).then(function () {
          this.trigger('ajax_receipt_login', '/inscription')
        }.bind(this))
      } else if (data.err == 'google_user') {
        this.trigger('google_user')
        this.sleep(2000).then(function () {
          this.trigger('ajax_receipt_login', '/inscription')
        }.bind(this))
      } else if (data.err == 'user_exist') {
        this.trigger('email_already_exist')
        this.sleep(2000).then(function () {
          this.trigger('ajax_receipt_login', '/inscription')
        }.bind(this))
      } else if (data.err == 'name_bad_format') {
        this.trigger('name_bad_format')
        this.sleep(2000).then(function () {
          this.trigger('ajax_receipt_login', '/inscription')
        }.bind(this))
      } else if (data.err == 'job_bad_format') {
        this.trigger('job_bad_format')
        this.sleep(2000).then(function () {
          this.trigger('ajax_receipt_login', '/inscription')
        }.bind(this))
      } else if (data.err == 'bad_email') {
        this.trigger('bad_email')
        this.sleep(2000).then(function () {
          this.trigger('ajax_receipt_login', '/inscription')
        }.bind(this))
      }
    })
  })

  this.on('google_user_connect', function () {
    this.utilStore.ajaxCall({
      method: 'get',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      beforeSend: function () {
        this.trigger('ajax_send_login')
      }.bind(this),
      contentType: 'text/html',
      url: '/data/auth/google'
    }).done(data => {
      sleep(2000).then(function () {
        this.trigger('ajax_receipt_login', '/connexion')
      }.bind(this))
      // if(data != null && data.token != null){
      //   localStorage.token = data.token
      //   window.open("../ihm/application.html", "_self");
      // }else{
      //   this.trigger('email_already_exist')
      // }
    })
  })
}
