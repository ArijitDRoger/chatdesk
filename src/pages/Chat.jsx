// src/pages/Chat.jsx
import "./Chat.css";
import React, { useEffect, useState } from "react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { useNavigate } from "react-router-dom";
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

  // 🔁 Auth listener and data loaders
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

  // 🔁 Real-time message listener
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

    // Get outgoing friend requests
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

      // Remove duplicate friendIds just in case
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
    <div className="container-fluid vh-100 d-flex flex-column p-0">
      {/* Header */}
      <div className="bg-dark text-white d-flex align-items-center justify-content-between p-3">
        <div className="d-flex align-items-center gap-3">
          <FaBell className="pointer" title="Notifications" />
          <FaUserFriends
            className="pointer"
            title="Friend Requests"
            onClick={() => setShowRequests(!showRequests)}
          />
        </div>
        <h3 className="m-0">ChatDesk</h3>
        <div className="d-flex align-items-center gap-3">
          <span className="text-light small">
            {user?.displayName || "User"}
          </span>
          <button
            className="btn btn-sm btn-outline-light"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Friend Requests Popup */}
      {showRequests && (
        <div
          className="position-absolute bg-white border p-3 request-popup"
          style={{ top: "60px", left: "20px", zIndex: 10, width: "280px" }}
        >
          <h6>Friend Requests</h6>
          {friendRequests.length === 0 ? (
            <p className="text-muted">No requests</p>
          ) : (
            friendRequests.map((req) => (
              <div
                key={req.id}
                className="d-flex justify-content-between align-items-center border-bottom py-2"
              >
                <span className="small">{getFriendName(req.from)}</span>
                <div>
                  <button
                    className="btn btn-sm btn-success me-1"
                    onClick={() => acceptRequest(req)}
                  >
                    ✓
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => rejectRequest(req)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="row flex-grow-1 flex-column flex-md-row m-0">
        {/* Sidebar */}
        <div className="col-md-3 bg-light p-3 border-end sidebar">
          <h5>Search Friends</h5>
          <input className="form-control mb-3" placeholder="Search..." />

          <h5>Friends</h5>
          {friends.map((f, i) => (
            <div
              key={i}
              className="p-2 border mb-2 pointer"
              onClick={() => setSelectedFriend(f)}
            >
              {getFriendName(f.friendId)}
            </div>
          ))}

          <h5>Suggestions</h5>
          {suggestions.map((s) => (
            <div key={s.uid} className="p-2 border mb-2">
              <div>{s.name}</div>
              <button
                className="btn btn-sm btn-primary mt-1 friend-btn"
                onClick={() => sendFriendRequest(s.uid)}
              >
                Send Request
              </button>
            </div>
          ))}
        </div>

        {/* Chat Area */}
        <div className="col-md-9 p-3 d-flex flex-column chat-area">
          {selectedFriend ? (
            <>
              <h5>Chatting with {getFriendName(selectedFriend.friendId)}</h5>
              <div className="flex-grow-1 overflow-auto border p-2 mb-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={
                      msg.from === user.uid ? "text-end" : "text-start"
                    }
                  >
                    <span className="badge bg-secondary">{msg.text}</span>
                  </div>
                ))}
              </div>

              <div className="d-flex">
                <input
                  className="form-control"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                />
                <button
                  className="btn btn-primary ms-2"
                  onClick={handleSendMessage}
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-muted my-auto">
              <h5>Select a friend to start chatting</h5>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
