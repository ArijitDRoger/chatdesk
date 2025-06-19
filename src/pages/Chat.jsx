import React, { useEffect, useState } from "react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { useNavigate } from "react-router-dom";
import "../pages/Chat.css"; // adjust path if needed
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { FaBell, FaUserFriends } from "react-icons/fa";

export default function Chat() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [showRequests, setShowRequests] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        console.log("App installed");
      }
      setDeferredPrompt(null);
      setShowInstall(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        fetchSuggestions(u.uid);
        fetchFriendRequests(u.uid);
        fetchFriends(u.uid);
      } else {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && friends.length > 0) {
      fetchSuggestions(user.uid);
    }
  }, [user, friends]);

  useEffect(() => {
    if (!user || !selectedFriend || !selectedFriend.friendId) return;

    const chatId =
      user.uid > selectedFriend.friendId
        ? user.uid + selectedFriend.friendId
        : selectedFriend.friendId + user.uid;

    const q = query(
      collection(db, "messages", chatId, "chat"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => doc.data()));
    });

    return () => unsubscribe();
  }, [user, selectedFriend]);

  const fetchSuggestions = async (uid) => {
    const usersSnap = await getDocs(collection(db, "users"));
    const all = usersSnap.docs.map((doc) => doc.data());
    setAllUsers(all);

    const friendIds = friends.map((f) => f.friendId);

    const reqSnap = await getDocs(
      query(collection(db, "friendRequests"), where("from", "==", uid))
    );
    const pendingIds = reqSnap.docs.map((doc) => doc.data().to);

    const others = all.filter(
      (u) =>
        u.uid !== uid &&
        !friendIds.includes(u.uid) &&
        !pendingIds.includes(u.uid)
    );

    setSuggestions(others);
  };

  const fetchFriends = (uid) => {
    const q = query(collection(db, "friends"), where("userId", "==", uid));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      const unique = Array.from(
        new Map(data.map((f) => [f.friendId, f])).values()
      );
      setFriends(unique);
    });
  };

  const fetchFriendRequests = (uid) => {
    const q = query(collection(db, "friendRequests"), where("to", "==", uid));
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFriendRequests(requests);
    });
  };

  const handleSendMessage = async () => {
    if (!newMsg.trim()) return;

    const chatId =
      user.uid > selectedFriend.friendId
        ? user.uid + selectedFriend.friendId
        : selectedFriend.friendId + user.uid;

    await addDoc(collection(db, "messages", chatId, "chat"), {
      from: user.uid,
      to: selectedFriend.friendId,
      text: newMsg,
      timestamp: serverTimestamp(),
    });

    setNewMsg("");
  };

  const handleLogout = () => signOut(auth);

  const acceptRequest = async (req) => {
    await setDoc(doc(db, "friends", `${user.uid}_${req.from}`), {
      userId: user.uid,
      friendId: req.from,
    });
    await setDoc(doc(db, "friends", `${req.from}_${user.uid}`), {
      userId: req.from,
      friendId: user.uid,
    });
    await addDoc(collection(db, "friends"), {
      userId: req.from,
      friendId: user.uid,
    });
    await deleteDoc(doc(db, "friendRequests", req.id));
    fetchFriends(user.uid);
    fetchSuggestions(user.uid);
  };

  const rejectRequest = async (req) => {
    await deleteDoc(doc(db, "friendRequests", req.id));
  };

  const sendFriendRequest = async (toUid) => {
    if (toUid === user.uid) {
      alert("You can't send request to yourself.");
      return;
    }

    const q = query(
      collection(db, "friendRequests"),
      where("from", "==", user.uid),
      where("to", "==", toUid)
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
      alert("Request already sent.");
      return;
    }

    await addDoc(collection(db, "friendRequests"), {
      from: user.uid,
      to: toUid,
      status: "pending",
      timestamp: serverTimestamp(),
    });

    alert("Friend request sent.");
  };

  const getFriendName = (friendId) => {
    return allUsers.find((u) => u.uid === friendId)?.name || friendId;
  };

  return (
    <div className="chat-app">
      {/* Header */}
      <header className="chat-header">
        <div className="header-left">
          <FaBell />
          <FaUserFriends onClick={() => setShowRequests(!showRequests)} />
        </div>

        <h3 className="app-title">ChatDesk</h3>

        <div className="header-right">
          {showInstall && (
            <button onClick={handleInstallClick} className="btn-install">
              Download App
            </button>
          )}
          <span>{user?.displayName || "User"}</span>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      {/* Friend Requests */}
      {showRequests && (
        <div className="friend-requests">
          <h6>Friend Requests</h6>
          {friendRequests.length === 0 ? (
            <p>No requests</p>
          ) : (
            friendRequests.map((req) => (
              <div key={req.id} className="request-item">
                <span>{getFriendName(req.from)}</span>
                <div>
                  <button onClick={() => acceptRequest(req)}>✓</button>
                  <button onClick={() => rejectRequest(req)}>×</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Main Layout */}
      <main className="chat-main">
        {/* Sidebar */}
        <aside className="sidebar">
          <h5>Search Friends</h5>
          <input placeholder="Search..." />
          <h5>Friends</h5>
          {friends.map((f, i) => (
            <div key={i} onClick={() => setSelectedFriend(f)}>
              {getFriendName(f.friendId)}
            </div>
          ))}
          <h5>Suggestions</h5>
          {suggestions.map((s) => (
            <div key={s.uid}>
              <div>{s.name}</div>
              <button onClick={() => sendFriendRequest(s.uid)}>
                Send Request
              </button>
            </div>
          ))}
        </aside>

        {/* Chat Area */}
        <section className="chat-area">
          {selectedFriend ? (
            <>
              <h5>Chatting with {getFriendName(selectedFriend.friendId)}</h5>
              <div className="message-box">
                {messages.map((msg, i) => {
                  const time =
                    msg.timestamp?.toDate?.().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }) || "";

                  return (
                    <div
                      key={i}
                      className={`chat-message ${
                        msg.from === user.uid ? "sent" : "received"
                      }`}
                    >
                      <span>{msg.text}</span>
                      <small className="timestamp">{time}</small>
                    </div>
                  );
                })}

                <div id="chat-end" />
              </div>

              <div className="message-input">
                <input
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                />
                <button onClick={handleSendMessage}>Send</button>
              </div>
            </>
          ) : (
            <div className="empty-chat">
              <h5>Select a friend to start chatting</h5>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
