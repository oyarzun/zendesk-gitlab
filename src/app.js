(function () {
  var PROJECT_STATUS_ARCHIVED = false;

  /**
   * @param {object} this.settings - Data blob for settings coming from startup arguments.
   * @param {string} this.settings.gitlab_url - URL for Gitlab server to send issue information to.
   * @param {string} this.settings.gitlab_private_token - Private token for authenticating API calls to Gitlab server.
   * @param {boolean} this.settings.prepopulateTicketDescription - Set to true if we want all comments in zendesk ticket
   *                  with attachments to be prepopulated in additional comments box to be forwarded to gitlab issue.
   */
  return {
    PROJECT_TO_USE: 1,
    MEMBERS: [],
    LABELS: [],
    MILESTONES: [],
    PROJECTS: [],
    appID: 'GitLabAPP_IntegrationV1',
    requests: {
      getAudit: function ( id ) {
        this.showSpinner( true );
        return {
          url: '/api/v2/tickets/' + id + '/audits.json',
          type: 'GET',
          contentType: 'application/json',
          dataType: 'json'
        };
      },
      updateTicket: function ( id, data ) {
        this.showSpinner( true );
        return {
          url: '/api/v2/tickets/' + id + '.json',
          type: 'PUT',
          data: data,
          dataType: 'json',
          contentType: 'application/json'
        };
      },
      postGitLab: function ( project, data ) {
        this.showSpinner( true );
        return {
          url: this.settings.gitlab_url + '/api/v3/projects/' + this.PROJECT_TO_USE + '/issues?',
          type: 'POST',
          dataType: 'json',
          data: data,
          headers: { 'PRIVATE-TOKEN': this.settings.gitlab_private_token },
          secure: true,
          cors: true
        };
      },
      getProjects: function () {
        this.showSpinner( true );
        return {
          url: this.settings.gitlab_url + '/api/v3/projects',
          type: 'GET',
          dataType: 'json',
          headers: { 'PRIVATE-TOKEN': this.settings.gitlab_private_token },
          secure: true,
          cors: true
        };
      },
      getMilestones: function () {
        this.showSpinner( true );
        return {
          url: this.settings.gitlab_url + '/api/v3/projects/' + this.PROJECT_TO_USE + '/milestones/?',
          type: 'GET',
          dataType: 'json',
          headers: { 'PRIVATE-TOKEN': this.settings.gitlab_private_token },
          secure: true,
          cors: true
        };
      },
      getIssue: function ( issue_id, project_id ) {
        this.showSpinner( true );

        return {
          url: this.settings.gitlab_url + '/api/v3/projects/' + project_id + '/issues/' + issue_id + '?',
          type: 'GET',
          dataType: 'json',
          headers: { 'PRIVATE-TOKEN': this.settings.gitlab_private_token },
          secure: true,
          cors: true
        };
      },
      getLabels: function () {
        this.showSpinner( true );
        return {
          url: this.settings.gitlab_url + '/api/v3/projects/' + this.PROJECT_TO_USE + '/labels?',
          type: 'GET',
          dataType: 'json',
          headers: { 'PRIVATE-TOKEN': this.settings.gitlab_private_token },
          secure: true,
          cors: true
        };
      },
      getMembers: function () {
        this.showSpinner( true );
        return {
          url: this.settings.gitlab_url + '/api/v3/projects/' + this.PROJECT_TO_USE + '/members?',
          type: 'GET',
          dataType: 'json',
          headers: { 'PRIVATE-TOKEN': this.settings.gitlab_private_token },
          secure: true,
          cors: true
        };
      }
    },
    events: {
      'app.activated': 'onActivated',
      'postGitLab.done': 'result',
      'click #submitToGitLab': 'prep_to_post',
      'getProjects.done': 'listProjects',
      'getAudit.done': 'listIssues',
      'click .js-project': 'projectSelect',
      'updateTicket.done': 'reset',
      'click .issue': 'get_issue',
      'click .back_button': 'onActivated',

      'click .nav-pills .js-projects': function () {
        this.setActivePill( 'js-projects' );
        this.ajax( 'getProjects' );
      },
      'click .nav-pills .js-issues': function () {
        this.setActivePill( 'js-issues' );
        this.ajax( 'getAudit', this.ticket().id() );
      }
    },
    setActivePill: function ( itemClass ) {
      this.$( '.nav-pills li' ).removeClass( 'active' );
      this.$( '.nav-pills li.' + itemClass ).addClass( 'active' );
    },
    /**
     * @typedef {object} services - Creates notification inside zendesk page with related error text.
     * @prop {object} this - Handlebars template object.
     * @prop {function} this.switchTo(name, data) - Change view to new template, passing in name and data
     * @param {string} error_text - Text to be displayed when error occurs.
     */
    renderError: function ( error_text ) {
      services.notify( error_text, 'error' );
      this.switchTo( 'error', { error: error_text } );
    },
    onActivated: function () {
      console.log( 'Zendesk-GitLab loaded' );

      // Remove trailing slash from gitlab_url
      if ( this.settings.gitlab_url.search( '\/$' ) != -1 ) {
        this.settings.gitlab_url = this.settings.gitlab_url.slice( 0, -1 );
      }

      this.doneLoading = false;
      this.showSpinner( true );
      this.loadIfDataReady();
    },
    /**
     * @prop {object} this - Handlebars template object
     * @prop {boolean} this.doneLoading - Set to true upon onActivated event
     * @prop {function} this.ticket - Returns zendesk ticket object
     * @prop {function} this.ticket.requester - Returns zendesk requester object.
     */
    loadIfDataReady: function () {
      if ( !this.doneLoading && this.ticket().status() != null && this.ticket().requester().id() ) {
        this.doneLoading = true;
        this.ajax( 'getAudit', this.ticket().id() );
      }
    },
    /**
     * @prop {object} this - Handlebars template object
     * @prop {object} this.I18n - Translation library that pulls from translations folder for strings.
     * @prop {function} this.I18n.t({string}) - Pulls translation from folder and returns it in language of choice
     * @param {object} result - Gitlab project data
     * @param {string} result.web_url - Gitlab project URL
     * @param {number} result.id - Gitlab internal issue ID
     * @param {number} result.project_id - Gitlab internal project ID
     */
    result: function ( result ) {
      services.notify( this.I18n.t( 'issue.posted' ) );
      var id = result.id;
      var project_id = result.project_id;
      var web_url = result.web_url;

      var data = {
        "ticket": {
          "comment": {
            "public": false,
            "value": this.I18n.t( 'issue.pushed' ) + "\n\n" + web_url + "\n\n"
          }, "metadata": { "pushed_to_gitlab": true, "gitlab_id": id, "gitlab_project_id": project_id }
        }
      };
      data = JSON.stringify( data );
      this.ajax( 'updateTicket', this.ticket().id(), data );
    },
    listProjects: function ( data ) {
      if ( data == null ) {
        this.renderError( "No data returned. Please check your API key." );
        return false;
      }
      // Only show active projects and sort by name
      /**
       * @param {object} project - Data store for project information
       * @param {boolean} project.archived - Filter results based on active projects only.
       * @type {Array.<*>}
       */
      data = data.filter( function ( project ) {
        return project.archived === PROJECT_STATUS_ARCHIVED;
      } ).map( function ( project ) {
        // Prefix parent project's name
        if ( project.hasOwnProperty( 'parent' ) ) {
          project.name = project.parent.name + ' - ' + project.name;
        }
        return project;
      } ).sort( function ( a, b ) {
        if ( a.name.toLowerCase() < b.name.toLowerCase() ) return -1;
        if ( a.name.toLowerCase() > b.name.toLowerCase() ) return 1;
        return 0;
      } );

      this.PROJECTS = data;

      this.setActivePill( 'js-projects' );
      this.switchTo( 'projectList', { project_data: data } );
      this.showSpinner( false );
    },
    /**
     * @typedef {Function} this.ticket.customField - Returns the ticket custom field value as its defined type. Specify
     *                                               fieldName as custom_field_<custom field ID>
     *                                               https://developer.zendesk.com/apps/docs/agent/data#ticket-object
     * @typedef {Object} this.currentAccount - Returns the current account as an account object.
     *                                         https://developer.zendesk.com/apps/docs/agent/data#account-object
     * @typedef {Function} this.currentAccount.subdomain - Returns the current subdomain as a string.
     */
    prep_to_post: function () {
      this.showSpinner( true );

      var subject = this.$( '#gitlab_subject' ).val();
      var labels = this.$( '#gitlab_labels' ).val();
      //var priority = this.$( '#gitlab_priority' ).val();
      var asignee = this.$( '#gitlab_assignee' ).val();
      var milestone = this.$( '#gitlab_milestone' ).val();
      var due_date = null;

      if ( this.ticket().type() === "task" ) {
        due_date = this.ticket().customField( 'due_date' );
      }

      var description = "Ticket URL: https://" + this.currentAccount().subdomain() +
                        ".zendesk.com/tickets/" + this.ticket().id() + "\n\n" + this.$( '#gitlab_note' ).val();

      if ( subject.length < 1 ) {
        services.notify( 'You must include a subject.', 'error' );
      } else {
        var data = {
          "id": this.PROJECT_TO_USE,
          "title": subject,
          "description": description,
          "assignee_id": asignee,
          "milestone_id": milestone,
          "due_date": "due_date",
          "labels": labels ? labels.join( ',' ) : ""
        };
        this.ajax( 'postGitLab', this.PROJECT_TO_USE, data );
      }
    },
    projectSelect: function ( e ) {

      this.showSpinner( true );

      this.PROJECT_TO_USE = e.target.id;
      var doneRequests = 0;
      this.ajax( 'getLabels' )
        .done( function ( data ) {
          this.LABELS = data;
        }.bind( this ) )
        .always( function () {
          doneRequests++;
        } );

      this.ajax( 'getMilestones' )
        .done( function ( data ) {
          this.MILESTONES = data;
        }.bind( this ) )
        .always( function () {
          doneRequests++;
        } );

      this.ajax( 'getMembers' )
        .done( function ( data ) {
          var members = [];
          data.forEach( function ( membership ) {
            members.push( membership );
          } );
          this.MEMBERS = data;
        }.bind( this ) )
        .always( function () {
          doneRequests++;
        } );

      // Wait for all three requests to finish
      var interval = setInterval( function () {
        if ( doneRequests == 3 ) {

          clearInterval( interval );
          this.showSpinner( false );

          var description = [];

          if ( this.settings.prepopulateTicketDescription ) {
            /**
             * Stars (**) around author name show up as bold on Gitlab description. Comment numbering matches ordering
             * from zendesk ticket internal comments. Put each comment in a Markdown block quote for readability.
             * @param {Object} comment - Comment object returned by ticket iterator.
             * @param {Function} comment.author - Returns author object for current comment.
             * @param {Function} comment.imageAttachments - Returns array of image attachment objects.
             * @param {Function} comment.nonImageAttachments - Returns array of non image attachment objects.
             */
            this.ticket().comments().forEach( function ( comment, index, arr ) {
              description.push( '**' + comment.author().name() + '** (Comment ' + (arr.length - index) + '):' );
              description.push('>>>'); // Open block-quote
              description.push(comment.value().replace(/>\s</g, '><')); //Remove whitespace between html elements.

              /**
               * @param {Object} attachment - Attachment object from comment iterator
               * @param {Function} attachment.filename - Returns filename of attachment as string
               * @param {Function} attachment.contentUrl - Returns content url of attachment as string
               */
              comment.imageAttachments().forEach( function ( attachment ) {
                if(attachment && attachment.filename && attachment.contentUrl){
                  description.push('![' + attachment.filename() + '](' + attachment.contentUrl() + ')')
                }
              } );

              /**
               * @param {Object} attachment - Attachment object from comment iterator
               * @param {Function} attachment.filename - Returns filename of attachment as string
               * @param {Function} attachment.contentUrl - Returns content url of attachment as string
               */
              comment.nonImageAttachments().forEach( function ( attachment ) {
                if(attachment && attachment.filename && attachment.contentUrl){
                  description.push('[' + attachment.filename() + '](' + attachment.contentUrl() + ')')
                }
              } );
              description.push('>>>\n'); //Close Blockquote
            } );

            if ( this.ticket().type() === "incident" && this.ticket().customField( 'problem_id' ) ) {
              description.push( "ProblemID: " + this.ticket().customField( 'problem_id' ) );
            }

            if ( this.ticket().type() === "task" ) {
              description.push( "Due Date: " + this.ticket().customField( 'due_date' ) );
            }
            /**
             * https://developer.zendesk.com/apps/docs/agent/data#user-object
             * @param {Function} this.ticket.type - Gets the ticket type. Returns one of the following values: ticket,
             *                                      question, incident, problem, task.
             * @typedef {Function} this.ticket.assignee - Returns the ticket assignee as an object.
             * @typedef {Function} this.ticket.assignee.user - Returns user object for assignee attached to ticket.
             *                                            https://developer.zendesk.com/apps/docs/agent/data#user-object
             * @param {Function} this.ticket.assignee.user.name - Returns the user name as a string.
             * @param {Function} this.ticket.priority - Returns one of: -, low, normal, high, urgent.
             * @param {Function} this.ticket.requester - Returns the ticket requester as an user object.
             * @param {Function} this.ticket.requester.name - Returns the ticket requester's name as a string.
             * @param {Function} this.ticket.status - Returns one of: new, open, pending, solved, closed, deleted.
             * @param {Function} this.ticket.createdAt - Returns when the ticket was created using the ISO 8601 format.
             */
            description.push( "**Type**: " + this.ticket().type() + "\r" );
            description.push( "**Assignee**: " + this.ticket().assignee().user().name() + "\r" );
            description.push( "**Priority**: " + this.ticket().priority() + "\r" );
            description.push( "**Requester**: " + this.ticket().requester().name() + "\r" );
            description.push( "**Status**: " + this.ticket().status() + "\r" );
            description.push( "**Created**: " + this.ticket().createdAt() + "\r" );
          }

          this.switchTo( 'newIssue', {
            labels: this.LABELS,
            members: this.MEMBERS,
            subject: this.ticket().subject(),
            description: description.join( "\n" )
          } );
        }
      }.bind( this ), 500 );
    },
    /**
     * @param {Object} data - Holds information for history of internal messages in zendesk ticket
     * @param {Array}  data.audits - Array of comment objects for history of ticket.
     * @param {Number} data.count - Number of comments made on this ticket.
     * @param {Object} data.audits[].metadata - Holds custom and system information.
     * @param {Object} data.audits[].metadata.custom - Holds attributes about comment related to Gitlab issue this
     *                                                 ticket has possibly been attached to. Empty on first use.
     */
    listIssues: function ( data ) {
      var ticketHasIssue = false;
      var issueList = [];
      for ( var i = 0; i <= data.count; i++ ) {
        try {
          var gitlab_meta = data.audits[ i ].metadata.custom;
          if ( gitlab_meta.pushed_to_gitlab ) {
            ticketHasIssue = true;
            if ( gitlab_meta.gitlab_project_id ) {
              issueList.push( {
                issue_id: gitlab_meta.gitlab_id,
                project_id: gitlab_meta.gitlab_project_id
              } );
            }
          }
        } catch ( err ) {
        }
      }

      if ( !ticketHasIssue ) {
        // No issues available, so load project list
        this.ajax( 'getProjects' );
        this.showIssueTab( false );
        return;
      }

      this.showIssueTab( true );

      var spawned = 0;
      var returned = 0;
      var issueDetails = [];
      issueList.forEach( function ( issue ) {
        spawned++;
        this.ajax( 'getIssue', issue.issue_id, issue.project_id )
          .done( function ( data ) {
            data.closed = (data.state == 'closed');
            issueDetails.push( data );
          }.bind( this ) )
          .fail( function () {
            this.renderError( "Specified issue ticket was not found in " + this.name() );
          } )
          .always( function () {
            returned++;
          } );
      }.bind( this ) );

      var interval = setInterval( function () {
        if ( spawned == returned ) {
          clearTimeout( interval );

          this.setActivePill( 'js-issues' );
          this.switchTo( 'issueList', { issues: issueDetails } );
          this.showSpinner( false );
        }
      }.bind( this ), 500 );

    },
    reset: function () {
      this.ajax( 'getAudit', this.ticket().id() );
    },

    /**
     * @param {Object} e - Browser event, expecting 'click'
     * @member {Number} e.target.dataset.id - External (web url) version of issue id in Gitlab.
     * @member {Number} e.target.dataset.pid - Internal identifier for Gitlab project clicked issue is attached to.
     */
    get_issue: function ( e ) {
      this.showSpinner( true );
      var issue_id = e.target.dataset.id;
      var project_id = e.target.dataset.pid;
      this.ajax( 'getIssue', issue_id, project_id )
        .done( function ( data ) {
          this.show_issue( data );
        }.bind( this ) )
        .fail( function () {
          this.renderError( "Specified issue ticket was not found in " + this.name() );
        } );
    },
    show_issue: function ( data ) {
      this.setActivePill( 'js-issues' );
      this.showSpinner( false );
      this.switchTo( 'showIssue', {
        issue: data,
        url: data.web_url
      } );
    },
    showSpinner: function ( status ) {
      if ( status === true ) {
        this.$( '#spinner' ).show();
        this.$( '#main' ).hide();
      } else {
        this.$( '#spinner' ).hide();
        this.$( '#main' ).show();
      }
    },
    showIssueTab: function ( status ) {
      if ( status ) {
        this.$( '.js-issues' ).show();
      } else {
        this.$( '.js-issues' ).hide();
      }
    }
  };
}());
