// import Codebird from "codebird";
declare function Codebird(): void;

import * as cfData from "@crossfoam/data";
import config from "../config.js";

// Allow content_scripts to include the services module without codebird
let cb;
if (typeof Codebird === "function") {
  cb = new Codebird();
  cb.setUseProxy(false);
  cb.setConsumerKey(config.api_key, config.api_secret);
}

const requestTokenKey = "twitter--request-token";
const authTokenKey = "twitter--auth-token";

const authRequired = (): Promise<boolean> => {
  return cfData.get(authTokenKey)
    .then((value) => {
      if (value && value !== undefined && ("oauth_token" in value)) {
        return testAuth(value);
      } else {
        return true;
      }
    });
};

const testAuth = (data: any): Promise<boolean> => {
  cb.setToken(data.oauth_token, data.oauth_token_secret);
  return cb.__call(
    "account_verifyCredentials",
    {},
  ).then((result) => {
    console.log(result);
    return false;
  });
};

const createOptions = (htmlContainer: HTMLElement) => {
  authRequired()
    .then((required) => {
      if (required) {
        htmlContainer.innerHTML = "<button id='twitter--auth-button'>Authorize Twitter</button>";
        document.getElementById("twitter--auth-button")
          .addEventListener("click", () => {
            auth(htmlContainer);
          });
      } else {
        htmlContainer.innerHTML = "Twitter is authorized and ready to go.";
      }
    })
    .catch((err) => {
      throw err;
    });
};

const cbCall = (endpoint: string, params: {}): Promise<any> => {
  // TODO: Check if authentication is still valid, otherwise throw error

  return cfData.get(authTokenKey)
    .then((data) => {
      cb.setToken(data.oauth_token, data.oauth_token_secret);
      return cb.__call(endpoint, params);
    });
};

const cbErrorHandling = (result: any): string => {

  if (
    ("errors" in result.reply && result.reply.errors.length >= 1)
    || "error" in result.reply
  ) {

    if (("errors" in result.reply && result.reply.errors[0].message === "Not authorized.")
       || result.reply.httpstatus === 401
       || ("error" in result.reply && result.reply.error === "Not authorized.")) {

      // TODO: Handle losing authorization
      let isAuthRequired = false;

      (async () => {
        isAuthRequired = await authRequired();
      })();

      if (isAuthRequired) {
        console.log("not authorized");
        return "auth";
      } else {
        return "again";
      }

    } else if ("errors" in result.reply && result.reply.errors[0].code === 88) {

      return "again";

    } else {

      throw new Error(JSON.stringify(result));
      return "again";

    }
  } else if (result.reply.httpstatus === 0) {

    return "again";

  } else {

    return "good";

  }

};

/*
 * The auth function handles the authentication, if required
 * If any interaction between the options page the authentication is required
 * the html_container element is a div, allowing the modul to embed interactions
 * The data object gives access to the data storage functionalities
 */

const auth = (htmlContainer: HTMLElement): Promise<boolean> => {
  return cb.__call(
    "oauth_requestToken",
    {oauth_callback: "oob"},
  )
  .then((reply) => {
    return cfData.set(requestTokenKey, reply.reply);
  })
  .then( (requestToken) => {
    cb.setToken(requestToken.oauth_token, requestToken.oauth_token_secret);
    return cb.__call(
      "oauth_authorize",
      {},
    );
  })
  .then((authUrl) => {
    return browser.tabs.create({url: authUrl.reply});
  })
  .then(() => {
    // Modify the html add a click listener with connection to new function
    htmlContainer.innerHTML = "<input \
                type='text' \
                placeholder='Twitter PIN' \
                id='twitter--auth-pin' />\
              <button \
                id='twitter--auth-button'>\
                Finish authorization\
              </button>";
    document.getElementById("twitter--auth-button")
      .addEventListener("click", () => {
        const value = (document.getElementById("twitter--auth-pin") as HTMLInputElement).value;
        if (value && value.length === 7) {
          auth2(htmlContainer, value);
        } else {
          alert("Please input a valid 7-digit Twitter-Auth-Pin.");
        }
      });
  });
};

const auth2 = (htmlContainer: HTMLElement, pin: string) => {
  return cb.__call(
    "oauth_accessToken",
    {oauth_verifier: pin},
  ).then((reply) => {
    cfData.set(authTokenKey, reply.reply);
    htmlContainer.innerHTML = "Twitter is authorized and ready to go.";
  });
};

const getBiggerPicture = (url: string): string => {
  const search = "normal";
  const replace = "bigger";

  const position = url.lastIndexOf(search);

  if (position > 0) {
    url = url.substr(0, position) +
      replace +
      url.substr(position + search.length);
  }

  return url;
};

const getUser = (screenName: string, timestamp: number, uniqueID: string, queue: any): Promise<any> => {
  return cbCall("users_show", {
    screen_name: screenName,
  }).then((result) => {

    const errorAnalysis = cbErrorHandling(result);

    if (errorAnalysis === "again") {
      queue.call(config.service_key + "--getUser", [
        screenName,
      ], timestamp, uniqueID);

      return Promise.resolve();
    } else if ( errorAnalysis === "auth") {
      console.log("AAAAHHHHH auth me!");
    } else {

      return cfData.get(`s--${config.service_key}--nw--${screenName}`, {})
        .then((networkObject) => {
          const nUuid = uniqueID;
          networkObject[nUuid] = {
            callCount: null,
            completeCount: 0,
            date: Date.now(),
            lastUpdated: Date.now(),
            screenName,
            state: "queuing",
          };
          return cfData.set(`s--${config.service_key}--nw--${screenName}`, networkObject)
            .then(() => {
              return cfData.set(`s--${config.service_key}--a--${screenName}-${nUuid}--c`, {
                followers_count: result.reply.followers_count,
                friends_count: result.reply.friends_count,
                handle: screenName,
                id: result.reply.id_str,
                image: getBiggerPicture(result.reply.profile_image_url_https),
                name: result.reply.name,
              });
            })
            .then(() => {
              queue.call(config.service_key + "--getFriendsIds", [screenName, undefined, screenName, nUuid, -1],
                    timestamp, uniqueID);
              // queue.call("getFollowersIds", [screenName, true, nUuid, -1]);
              return Promise.resolve();
            });
        });
    }
  });
};

// The web extension does not support the scraping of protected accounts
// This is implemented on privacy purpose to protect such accounts
const scrapeAble = (screenName: string, userId: string, centralNode: string, nUuid: string): Promise<boolean> => {
  return cfData.get(`s--${config.service_key}--a--${centralNode}-${nUuid}--n`, {})
    .then((nodes) => {
      if (userId in nodes && !nodes[userId].protected) {
        return true;
      } else {
        return false;
      }
    });
};

const getFriendsIds = (  screenName: string, userId: string, centralNode: string,
                         nUuid: string, cursor: string,
                         timestamp: number, uniqueID: string, queue: any): Promise<any> => {

  // Check if this user is scrape-able
  return scrapeAble(screenName, userId, centralNode, nUuid)
    .then((isScrapeAble) => {

      if (!isScrapeAble && screenName !== centralNode) {

        return Promise.resolve();

      } else {

        const params = {
          count: 5000,
          cursor,
          stringify_ids: true,
        };

        if (userId === null || userId === undefined || !userId) {
          Object.assign(params, {screen_name: screenName});
        } else {
          Object.assign(params, {user_id: userId});
        }

        return cbCall("friends_ids", params).then((result) => {

          const errorAnalysis = cbErrorHandling(result);

          if (errorAnalysis === "again") {
            queue.call(config.service_key + "--getFriendsIds", [
              screenName, userId, centralNode,
              nUuid, cursor,
            ], timestamp, uniqueID);

            return Promise.resolve();
          } else if ( errorAnalysis === "auth") {
            console.log("AAAAHHHHH auth me!");
          } else {

            if (result.reply.ids === null) {

              // So far not able to figure this out
              queue.call(config.service_key + "--getFriendsIds", [
                screenName, userId, centralNode,
                nUuid, cursor,
              ], timestamp, uniqueID);

              return Promise.resolve();
            } else {

              return cfData.get(`s--${config.service_key}--a--${centralNode}-${nUuid}--n`, {})
                .then((nodes) => {
                  if (screenName === centralNode) {
                    const newNodes = {};
                    result.reply.ids.forEach( (id) => {
                      newNodes[id] = {
                        followers: [],
                        followers_count: 0,
                        friends: [],
                        friends_count: 0,
                        handle: null,
                        image: null,
                        name: null,
                      };
                    });

                    Object.assign(nodes, newNodes);
                  } else {
                    // make sure we don't have duplicates in here...
                    result.reply.ids.forEach((newNode) => {
                      if (nodes[userId].friends.indexOf(newNode) === -1) {
                        nodes[userId].friends.push(newNode);
                      }
                    });
                  }
                  return cfData.set(`s--${config.service_key}--a--${centralNode}-${nUuid}--n`, nodes);
                })
                .then((savedData) => {
                  if (result.reply.next_cursor_str && result.reply.next_cursor_str !== "0"
                      && result.reply.next_cursor_str !== 0
                      // LIMIT the number of friends of friends to 20.000
                      // TODO: move to configs
                      && savedData[userId].friends.length < 20000) {

                    queue.call(config.service_key + "--getFriendsIds", [
                      screenName, userId, centralNode,
                      nUuid, result.reply.next_cursor_str,
                    ], timestamp, uniqueID);

                    return Promise.resolve();
                  } else {
                    queue.call("network--estimateCompletion", [config.service_key, centralNode, nUuid],
                      timestamp, uniqueID);

                    if (centralNode === screenName) {
                      queue.call(config.service_key + "--getFriends", [screenName, userId, centralNode, nUuid, -1],
                            timestamp, uniqueID);
                      return cfData.get(`s--${config.service_key}--a--${centralNode}-${nUuid}--n`, {})
                        .then((nodes) => {
                          Object.keys(nodes).forEach((id) => {
                            queue.call(config.service_key + "--getFriendsIds", [undefined, id, centralNode, nUuid, -1],
                                  timestamp, uniqueID);
                          });
                          return Promise.resolve();
                        });
                    } else {
                      return Promise.resolve();
                    }
                  }
                });
            }
          }
        });

      }

    });
};

const getFriends = (  screenName: string, userId: string, centralNode: string,
                      nUuid: string, cursor: string,
                      timestamp: number, uniqueID: string, queue: any): Promise<any> => {

  // Check if this user is scrape-able
  return scrapeAble(screenName, userId, centralNode, nUuid)
    .then((isScrapeAble) => {

      if (!isScrapeAble && screenName !== centralNode) {

        return Promise.resolve();

      } else {

        const params = {
          count: 200,
          cursor,
          include_user_entities: false,
          skip_status: true,
        };

        if (userId === null || userId === undefined || !userId) {
          Object.assign(params, {screen_name: screenName});
        } else {
          Object.assign(params, {user_id: userId});
        }

        return cbCall("friends_list", params).then((result) => {

          console.log("friends_list", result);

          const errorAnalysis = cbErrorHandling(result);

          if (errorAnalysis === "again") {
            queue.call(config.service_key + "--getFriends", [
              screenName, userId, centralNode,
              nUuid, cursor,
            ], timestamp, uniqueID);
            return Promise.resolve();
          } else if ( errorAnalysis === "auth") {
            console.log("AAAAHHHHH auth me!");
          } else {

            return cfData.get(`s--${config.service_key}--a--${centralNode}-${nUuid}--n`, {})
              .then((nodes) => {

                result.reply.users.forEach((user) => {
                  if (user.id_str  in nodes) {
                    nodes[user.id_str].name = user.name;
                    nodes[user.id_str].handle = user.screen_name;
                    nodes[user.id_str].followers_count = user.followers_count;
                    nodes[user.id_str].friends_count = user.friends_count;
                    nodes[user.id_str].handle = user.screen_name;
                    nodes[user.id_str].image = getBiggerPicture(user.profile_image_url_https);
                    nodes[user.id_str].protected = user.protected;
                  }
                });

                return cfData.set(`s--${config.service_key}--a--${centralNode}-${nUuid}--n`, nodes);

              })
              .then(() => {
                if (result.reply.next_cursor_str && result.reply.next_cursor_str !== "0"
                    && result.reply.next_cursor_str !== 0) {
                  queue.call(config.service_key + "--getFriends",
                     [screenName, userId, centralNode, nUuid, result.reply.next_cursor_str],
                     timestamp, uniqueID);
                } else {
                  queue.call("network--estimateCompletion", [config.service_key, centralNode, nUuid]);
                }
                return Promise.resolve();
              });
          }
        });
      }
    });
};

const getUsers = (  centralNode: string, nUuid: string,
                    timestamp: number, uniqueID: string, queue: any): Promise<any> => {

  return Promise.all([
    cfData.get(`s--${config.service_key}--a--${centralNode}-${nUuid}--nw`, {proxyKeys: []}),
    cfData.get(`s--${config.service_key}--a--${centralNode}-${nUuid}--n`, {}),
  ]).then((data) => {
    const query = [];
    const limit = 100;
    let more = false;

    // TODO: this should be relative to the overall size of the core-network
    const proxySizeLimit = 5;

    Object.keys(data[0].proxyKeys).forEach((proxy) => {
      if (!(proxy in data[1]) && data[0].proxies[data[0].proxyKeys[proxy]][5] > proxySizeLimit) {
        if (query.length < limit) {
          query.push(proxy);
        } else {
          more = true;
        }
      }
    });

    if (query.length > 0) {
      const params = {
        user_id: query.join(","),
      };

      return cbCall("users_lookup", params).then((result) => {

        const errorAnalysis = cbErrorHandling(result);

        if (errorAnalysis === "again") {
          queue.call(config.service_key + "--getUsers", [
            centralNode, nUuid,
          ], timestamp, uniqueID);
          return Promise.resolve();
        } else if ( errorAnalysis === "auth") {
          console.log("AAAAHHHHH auth me!");
        } else {

          result.reply.forEach((user) => {
            if (! (user.id_str in data[1])) {
              data[1][user.id_str] = {};
            }

            data[1][user.id_str].name = user.name;
            data[1][user.id_str].followers_count = user.followers_count;
            data[1][user.id_str].friends_count = user.friends_count;
            data[1][user.id_str].handle = user.screen_name;
            data[1][user.id_str].image = getBiggerPicture(user.profile_image_url_https);
            data[1][user.id_str].protected = user.protected;
          });

          // Some IDs will not return any results, because they are protected
          query.forEach((proxyId) => {
            if (! (proxyId in data[1])) {
              data[1][proxyId] = {};
            }
          });

          return cfData.set(`s--${config.service_key}--a--${centralNode}-${nUuid}--n`, data[1])
            .then((savedData) => {
              if (more && queue) {

                queue.call(config.service_key + "--getUsers",
                   [centralNode, nUuid],
                   timestamp, uniqueID);

              } else {

                queue.call("network--cleanupNetwork",
                   [config.service_key, centralNode, nUuid],
                   timestamp, uniqueID);

                Promise.resolve();
              }
            });
        }
      });

    } else {
      queue.call("network--cleanupNetwork",
        [config.service_key, centralNode, nUuid],
        timestamp, uniqueID);

      return Promise.resolve();
    }

  });
};

// TODO: Is this still being used??
const removeNetwork = (centralNode: string, nUuid: string): Promise<any> => {
  return cfData.get(`s--${config.service_key}--nw--${centralNode}`)
    .then((networkData) => {
      delete networkData[nUuid];
      return cfData.set(`s--${config.service_key}--nw--${centralNode}`, networkData)
        .then(() => {
          return Promise.all([
              cfData.remove(`s--${config.service_key}--a--${centralNode}-${nUuid}--c`),
              cfData.remove(`s--${config.service_key}--a--${centralNode}-${nUuid}--n`),
            ]);
        });
    });
};

export { auth, authRequired, config, createOptions, getFriends, getFriendsIds, getUser, getUsers, removeNetwork };
